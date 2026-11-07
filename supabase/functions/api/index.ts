// SpotMe API — the server-side backend.
//
// The app calls supabase.functions.invoke(<name>, { body }) exactly as before;
// the client wrapper forwards every call here as { fn: <name>, body }.
// Runs with the service role, so every action authorizes the caller itself:
// user identity comes from the verified JWT, never from the request body.

import { createClient } from "npm:@supabase/supabase-js@2";
import { stripe, stripeMode, stripeKeyKind } from "../_shared/stripe.ts";

// Payout accounts are per Stripe mode; only the ones matching the server key are usable
const LIVEMODE = stripeKeyKind.endsWith("_live");
import { onPaymentCompleted } from "../_shared/payments.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = (Deno.env.get("APP_ORIGINS") ?? "https://spotmeone.com,https://www.spotmeone.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
const DEFAULT_ORIGIN = ALLOWED_ORIGINS[0];

const CATEGORIES = ["Bills", "Kids", "Groceries", "Health/Fitness", "Self-Care", "Transportation", "Other"];
const SPOTTER_TIERS: Record<string, { name: string; amount: number }> = {
  micro: { name: "Micro Spotter", amount: 10 },
  bold: { name: "Bold Spotter", amount: 30 },
  champion: { name: "Champion Spotter", amount: 40 },
};
const MAX_ACTIVE_NEEDS = 4;
const NEED_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
// Donations are held by the platform until the need's goal is met
const PAYOUT_STATUSES = ["Goal Met", "Payout Requested", "Paid"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {}

type Ctx = { uid: string | null; email: string | null; isAdmin: boolean };

// ============================================================
// Helpers
// ============================================================

function sanitize(str: unknown, max = 500): string {
  if (typeof str !== "string" || !str) return "";
  return str.replace(/<[^>]*>/g, "").replace(/[<>]/g, "").trim().slice(0, max);
}

function money(n: unknown): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function requireUser(ctx: Ctx): string {
  if (!ctx.uid) throw new HttpError("Please sign in to continue.");
  return ctx.uid;
}

function requireAdmin(ctx: Ctx) {
  if (!ctx.isAdmin) throw new HttpError("Not an admin");
}

// Only redirect back to our own site
function safeUrl(url: unknown, fallbackPath: string): string {
  if (typeof url === "string") {
    try {
      const u = new URL(url);
      if (ALLOWED_ORIGINS.includes(u.origin) || u.hostname === "localhost") return u.toString();
    } catch { /* fall through */ }
  }
  return `${DEFAULT_ORIGIN}${fallbackPath}`;
}

const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

async function getCtx(req: Request): Promise<Ctx> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === ANON_KEY) return { uid: null, email: null, isAdmin: false };
  const { data } = await db.auth.getUser(token);
  const user = data?.user;
  if (!user || user.is_anonymous) return { uid: null, email: null, isAdmin: false };
  const { data: isAdmin } = await db.rpc("spotme_is_admin", { p_user_id: user.id });
  return { uid: user.id, email: user.email ?? null, isAdmin: !!isAdmin };
}

async function getProfile(uid: string) {
  const { data } = await db.from("profiles")
    .select("id, name, avatar, bio, city, verified, trust_score, trust_level, total_raised, total_given, created_at, spotter_tier")
    .eq("id", uid).maybeSingle();
  return data;
}

function profileToUser(p: any) {
  return {
    id: p.id,
    name: p.name || "SpotMe User",
    avatar: p.avatar || "",
    bio: p.bio || "",
    city: p.city || "",
    joinedDate: p.created_at,
    totalRaised: Number(p.total_raised || 0),
    totalGiven: Number(p.total_given || 0),
    verified: !!p.verified,
    trustScore: p.trust_score || 0,
    trustLevel: p.trust_level || "new",
  };
}

function isExpired(need: any): boolean {
  const expiresAt = need.expires_at ? new Date(need.expires_at).getTime() : new Date(need.created_at).getTime() + NEED_LIFETIME_MS;
  return Date.now() >= expiresAt;
}

function mapNeed(need: any, profile: any = {}, contributions: any[] = []) {
  return {
    id: need.id,
    userId: need.user_id,
    userName: need.user_name?.trim() ? need.user_name : (profile.name || "SpotMe User"),
    // The poster's current profile photo wins over the copy stored on the need
    userAvatar: profile.id ? (profile.avatar || "") : (need.user_avatar || ""),
    userCity: need.user_city?.trim() ? need.user_city : (profile.city || ""),
    userVerified: profile.verified || false,
    userTrustScore: profile.trust_score || 0,
    userTrustLevel: profile.trust_level || "new",
    title: need.title,
    message: need.message,
    category: need.category,
    goalAmount: Number(need.goal_amount),
    raisedAmount: Number(need.raised_amount),
    contributorCount: need.contributor_count || 0,
    status: need.status,
    photo: need.photo,
    verificationStatus: need.verification_status,
    createdAt: need.created_at,
    expiresAt: need.expires_at || null,
    updatedAt: need.updated_at || null,
    featured: need.featured || false,
    contributions: contributions.map((c: any) => ({
      id: c.id,
      userId: c.is_anonymous ? null : c.user_id,
      userName: c.user_name,
      userAvatar: c.user_avatar,
      amount: Number(c.amount),
      note: c.note,
      timestamp: c.created_at,
    })),
  };
}

async function notify(userId: string | null, n: { type: string; title: string; message: string; need_id?: string | null; avatar?: string }) {
  if (!userId) return;
  await db.from("notifications").insert({ user_id: userId, ...n });
}

// Load a need the caller owns (admins may act on any need)
async function ownedNeed(ctx: Ctx, needId: unknown) {
  const uid = requireUser(ctx);
  if (typeof needId !== "string" || !needId) throw new HttpError("Missing needId");
  const { data: need } = await db.from("needs").select("*").eq("id", needId).maybeSingle();
  if (!need) throw new HttpError("Need not found");
  if (need.user_id !== uid && !ctx.isAdmin) throw new HttpError("You can only change your own needs");
  return need;
}

async function expireNeeds(): Promise<number> {
  const { data } = await db.from("needs").update({ status: "Expired", updated_at: new Date().toISOString() })
    .eq("status", "Collecting").lt("expires_at", new Date().toISOString()).select("id");
  return data?.length || 0;
}

// ============================================================
// Stripe: payments
// ============================================================

// Charge = donation + tip, grossed up so Stripe's 2.9% + $0.30 is covered and
// the recipient receives exactly `amount`.
function pricing(amount: number, tip: number) {
  const gross = Math.ceil(((amount + tip + 0.30) / (1 - 0.029)) * 100) / 100;
  const stripeFee = money(gross - amount - tip);
  return { gross, stripeFee, grossCents: Math.round(gross * 100), feeCents: Math.round((tip + stripeFee) * 100) };
}

async function createPayment(opts: {
  ctx: Ctx; amount: number; tip: number; needId: string | null; needTitle: string; type: "contribution" | "spread";
  allocations: { needId: string; amount: number }[] | null; note: string; isAnonymous: boolean;
  guestName: string; receiptEmail?: string | null; retryOf?: string;
}) {
  const { ctx, amount, tip, needId, type } = opts;
  const profile = ctx.uid ? await getProfile(ctx.uid) : null;
  const contributorName = profile?.name || opts.guestName || "Anonymous";
  const { gross, stripeFee, grossCents } = pricing(amount, tip);
  const paymentId = crypto.randomUUID();

  const metadata: Record<string, string> = {
    payment_id: paymentId,
    need_id: needId || "",
    need_title: opts.needTitle.slice(0, 100),
    contributor_id: ctx.uid || "guest",
    type,
    contribution_amount: String(amount),
    tip_amount: String(tip),
    stripe_fee: String(stripeFee),
  };
  if (opts.retryOf) metadata.retry_of = opts.retryOf;

  const pi = await stripe("POST", "payment_intents", {
    amount: grossCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata,
    ...(opts.receiptEmail ? { receipt_email: opts.receiptEmail } : {}),
  }, `pi-${paymentId}`);

  const { error } = await db.from("payments").insert({
    id: paymentId,
    need_id: needId,
    contributor_id: ctx.uid,
    contributor_name: opts.isAnonymous ? "A kind stranger" : contributorName,
    contributor_avatar: opts.isAnonymous ? "" : (profile?.avatar || ""),
    amount,
    tip_amount: tip,
    application_fee: tip,
    recipient_receives: amount,
    stripe_payment_intent_id: pi.id,
    stripe_client_secret: pi.client_secret,
    status: "pending",
    mode: "stripe",
    destination_charge: false,
    connected_account_id: null,
    note: opts.note,
    is_anonymous: opts.isAnonymous,
    need_title: opts.needTitle,
    type,
    spread_allocations: opts.allocations,
  });
  if (error) {
    await stripe("POST", `payment_intents/${pi.id}/cancel`).catch(() => {});
    throw new Error(`Could not record payment: ${error.message}`);
  }

  return {
    success: true,
    paymentId,
    clientSecret: pi.client_secret,
    mode: "stripe",
    destinationCharge: false,
    tipAmount: tip,
    applicationFee: tip,
    recipientReceives: amount,
    chargeTotal: gross,
  };
}

// Settle a payment against Stripe's real state. Safe to call repeatedly and
// concurrently with the webhook: spotme_fulfill_payment completes it once.
async function syncPayment(payment: any) {
  if (payment.status === "completed" || payment.status === "transferred" || payment.status === "transferring") {
    return { success: true, paymentId: payment.id, status: "completed" };
  }
  if (!payment.stripe_payment_intent_id) return { success: false, error: "Unable to verify payment status" };

  const pi = await stripe("GET", `payment_intents/${payment.stripe_payment_intent_id}`);
  if (pi.status === "succeeded") {
    const { data: completedNow, error } = await db.rpc("spotme_fulfill_payment", { p_payment_id: payment.id });
    if (error) throw new Error(error.message);
    if (completedNow) await onPaymentCompleted(db, payment.id);
    return { success: true, paymentId: payment.id, status: "completed" };
  }
  if (pi.status === "requires_payment_method" && pi.last_payment_error || pi.status === "canceled") {
    await db.from("payments").update({
      status: "failed",
      failure_reason: pi.last_payment_error?.message || "Payment was not completed",
      failure_code: pi.last_payment_error?.code || pi.status,
      failed_at: new Date().toISOString(),
    }).eq("id", payment.id).eq("status", "pending");
    return { success: false, error: "Payment was not completed", status: pi.status };
  }
  return { success: true, paymentId: payment.id, status: pi.status };
}

async function reversePayment(p: any) {
  const allocations: { needId: string; amount: number }[] = p.type === "spread"
    ? (typeof p.spread_allocations === "string" ? JSON.parse(p.spread_allocations) : p.spread_allocations) || []
    : p.need_id ? [{ needId: p.need_id, amount: Number(p.amount) }] : [];
  for (const a of allocations) {
    const { data: need } = await db.from("needs").select("user_id, raised_amount, contributor_count, status, goal_amount").eq("id", a.needId).maybeSingle();
    if (!need) continue;
    const raised = Math.max(money(Number(need.raised_amount) - Number(a.amount)), 0);
    await db.from("needs").update({
      raised_amount: raised,
      contributor_count: Math.max((need.contributor_count || 0) - 1, 0),
      status: need.status === "Goal Met" && raised < Number(need.goal_amount) ? "Collecting" : need.status,
      updated_at: new Date().toISOString(),
    }).eq("id", a.needId);
    if (need.user_id) {
      const { data: owner } = await db.from("profiles").select("total_raised").eq("id", need.user_id).maybeSingle();
      if (owner) await db.from("profiles").update({ total_raised: Math.max(money(Number(owner.total_raised || 0) - Number(a.amount)), 0) }).eq("id", need.user_id);
    }
  }
  if (p.contributor_id) {
    const { data: giver } = await db.from("profiles").select("total_given").eq("id", p.contributor_id).maybeSingle();
    if (giver) await db.from("profiles").update({ total_given: Math.max(money(Number(giver.total_given || 0) - Number(p.amount)), 0) }).eq("id", p.contributor_id);
  }
}

// ============================================================
// Stripe: payouts (platform-collected donations -> recipient's connected account)
// ============================================================

async function transferPendingFunds(uid: string, needIds: string[], accountId: string, reason: string) {
  let transferred = 0, failed = 0, totalDollars = 0;
  if (needIds.length === 0) return { transferred, failed, totalDollars };
  const { data: eligible } = await db.from("needs").select("id").in("id", needIds).in("status", PAYOUT_STATUSES);
  needIds = (eligible || []).map((n) => n.id);
  if (needIds.length === 0) return { transferred, failed, totalDollars };

  const { data: payments } = await db.from("payments")
    .select("id, amount, need_id, stripe_payment_intent_id")
    .in("need_id", needIds).eq("status", "completed").eq("destination_charge", false);

  for (const payment of payments || []) {
    const cents = Math.round(Number(payment.amount) * 100);
    if (cents < 1) continue;

    // Claim the payment so concurrent requests can't transfer it twice
    const { data: claimed } = await db.from("payments").update({ status: "transferring" })
      .eq("id", payment.id).eq("status", "completed").select("id");
    if (!claimed?.length) continue;

    try {
      const pi = payment.stripe_payment_intent_id ? await stripe("GET", `payment_intents/${payment.stripe_payment_intent_id}`) : null;
      await stripe("POST", "transfers", {
        amount: cents,
        currency: "usd",
        destination: accountId,
        ...(pi?.latest_charge ? { source_transaction: pi.latest_charge } : {}),
        metadata: { payment_id: payment.id, need_id: payment.need_id, user_id: uid, type: reason },
      }, `transfer-${payment.id}`);
      await db.from("payments").update({ status: "transferred", connected_account_id: accountId }).eq("id", payment.id);
      transferred++;
      totalDollars += Number(payment.amount);
    } catch (err) {
      console.error(`[payout] transfer failed for ${payment.id}:`, (err as Error).message);
      await db.from("payments").update({ status: "completed" }).eq("id", payment.id).eq("status", "transferring");
      failed++;
    }
  }
  return { transferred, failed, totalDollars: money(totalDollars) };
}

async function syncConnectedAccount(uid: string) {
  const { data: account } = await db.from("connected_accounts").select("*").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
  if (!account?.stripe_account_id) return { account, live: null };
  let live: any;
  try {
    live = await stripe("GET", `accounts/${account.stripe_account_id}`);
  } catch (err) {
    // Stripe unreachable: report the last known status instead of failing the screen
    console.warn(`[connect] Stripe account lookup failed for ${uid}:`, (err as Error).message);
    return { account, live: null };
  }
  const updates = {
    payouts_enabled: !!live.payouts_enabled,
    charges_enabled: !!live.charges_enabled,
    details_submitted: !!live.details_submitted,
    onboarding_complete: !!(live.details_submitted && live.charges_enabled),
  };
  await db.from("connected_accounts").update(updates).eq("user_id", uid).eq("livemode", LIVEMODE);
  return { account: { ...account, ...updates }, live };
}

// ============================================================
// stripe-checkout
// ============================================================

async function stripeCheckout(action: string, body: any, ctx: Ctx): Promise<any> {
  switch (action) {
    case "create_checkout": {
      const amount = money(body.amount);
      const tip = Math.min(Math.max(money(body.tipAmount), 0), 1000);
      if (amount < 1 || amount > 10000) throw new HttpError("Amount must be between $1 and $10,000");
      const note = sanitize(body.note, 280);
      const isAnonymous = !!body.isAnonymous;
      const guestName = ctx.uid ? "" : sanitize(body.contributorName, 50);
      const guestEmail = typeof body.guestEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guestEmail.trim())
        ? body.guestEmail.trim().slice(0, 200) : null;
      const receiptEmail = ctx.email || guestEmail;

      if (body.type === "spread") {
        const raw = Array.isArray(body.spreadAllocations) ? body.spreadAllocations : [];
        const allocations = raw.map((a: any) => ({ needId: String(a.needId), amount: money(a.amount) }))
          .filter((a: any) => a.amount > 0);
        if (allocations.length === 0) throw new HttpError("Choose at least one need");
        const total = money(allocations.reduce((s: number, a: any) => s + a.amount, 0));
        if (Math.abs(total - amount) > 0.01) throw new HttpError("Spread amounts don't add up");
        const { data: needs } = await db.from("needs").select("id, status, verification_status, expires_at, created_at")
          .in("id", allocations.map((a: any) => a.needId));
        if ((needs || []).length !== allocations.length || needs!.some((n) => n.status !== "Collecting" || n.verification_status !== "approved" || isExpired(n))) {
          throw new HttpError("One of these needs is no longer accepting contributions. Please refresh.");
        }
        return await createPayment({ ctx, amount, tip, needId: null, needTitle: "Spread the Love", type: "spread", allocations, note, isAnonymous, guestName, receiptEmail });
      }

      const { data: need } = await db.from("needs").select("*").eq("id", body.needId).maybeSingle();
      if (!need || need.verification_status !== "approved") throw new HttpError("Need not found");
      if (need.status !== "Collecting" || isExpired(need)) throw new HttpError("This need is no longer accepting contributions.");
      if (need.user_id && need.user_id === ctx.uid) throw new HttpError("You can't contribute to your own need.");
      return await createPayment({ ctx, amount, tip, needId: need.id, needTitle: need.title, type: "contribution", allocations: null, note, isAnonymous, guestName, receiptEmail });
    }

    case "verify_payment": {
      let payment: any = null;
      if (body.paymentId) {
        ({ data: payment } = await db.from("payments").select("*").eq("id", body.paymentId).maybeSingle());
      }
      if (!payment && body.paymentIntentId) {
        ({ data: payment } = await db.from("payments").select("*").eq("stripe_payment_intent_id", body.paymentIntentId).maybeSingle());
      }
      if (!payment) return { success: false, error: "Payment not found" };
      return await syncPayment(payment);
    }

    case "get_payment": {
      const { data: p } = await db.from("payments").select("*").eq("id", body.paymentId).maybeSingle();
      if (!p) return { success: false, error: "Payment not found" };
      return {
        success: true,
        payment: {
          id: p.id, needId: p.need_id, amount: Number(p.amount), tipAmount: Number(p.tip_amount || 0),
          recipientReceives: Number(p.recipient_receives || p.amount), status: p.status, mode: p.mode,
          destinationCharge: p.destination_charge, needTitle: p.need_title, contributorName: p.contributor_name,
          note: p.note, isAnonymous: p.is_anonymous, completedAt: p.completed_at, createdAt: p.created_at,
        },
      };
    }

    case "fetch_failed_payments": {
      const uid = requireUser(ctx);
      const { data: payments } = await db.from("payments").select("*")
        .eq("contributor_id", uid).eq("status", "failed").order("failed_at", { ascending: false }).limit(20);
      const ids = (payments || []).map((p) => p.id);
      const { data: retries } = ids.length
        ? await db.from("payment_retries").select("*").in("payment_id", ids).order("retry_number")
        : { data: [] as any[] };
      return {
        success: true,
        failedPayments: (payments || []).map((p) => {
          const r = (retries || []).filter((x) => x.payment_id === p.id);
          return {
            id: p.id, amount: Number(p.amount), needId: p.need_id, needTitle: p.need_title || "",
            failureReason: p.failure_reason || "Payment failed", failureCode: p.failure_code || "unknown",
            failedAt: p.failed_at || p.created_at, createdAt: p.created_at, type: p.type || "contribution",
            canRetry: r.length < 3, retryCount: r.length, maxRetries: 3, autoRetryScheduled: false,
            retries: r.map((x) => ({
              id: x.id, retryNumber: x.retry_number, status: x.status, scheduledAt: x.scheduled_at,
              attemptedAt: x.attempted_at, completedAt: x.completed_at, result: x.result, error: x.error,
            })),
            note: p.note, isAnonymous: p.is_anonymous,
          };
        }),
      };
    }

    case "retry_payment": {
      const uid = requireUser(ctx);
      const { data: original } = await db.from("payments").select("*").eq("id", body.failedPaymentId).maybeSingle();
      if (!original || original.contributor_id !== uid) return { success: false, error: "Original payment not found" };
      const { count } = await db.from("payment_retries").select("id", { count: "exact", head: true }).eq("payment_id", original.id);
      if ((count || 0) >= 3) return { success: false, error: "This payment has been retried too many times." };
      const result = await stripeCheckout("create_checkout", {
        amount: original.amount, tipAmount: original.tip_amount, needId: original.need_id, note: original.note,
        isAnonymous: original.is_anonymous, type: original.type, spreadAllocations: original.spread_allocations,
      }, ctx);
      await db.from("payment_retries").insert({
        payment_id: original.id, retry_number: (count || 0) + 1, status: "pending", attempted_at: new Date().toISOString(),
      });
      return result;
    }

    case "fetch_payout_dashboard": {
      const uid = requireUser(ctx);
      const { data: account } = await db.from("connected_accounts").select("*").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
      const { data: userNeeds } = await db.from("needs").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      const needIds = (userNeeds || []).map((n) => n.id);
      const { data: paymentData } = needIds.length
        ? await db.from("payments").select("*").in("need_id", needIds).in("status", ["completed", "transferring", "transferred"])
          .order("completed_at", { ascending: false })
        : { data: [] as any[] };
      const payments = paymentData || [];
      const net = (p: any) => Number(p.recipient_receives || p.amount || 0);
      const totalReceived = payments.reduce((s, p) => s + net(p), 0);
      const totalFees = payments.reduce((s, p) => s + Number(p.application_fee || 0), 0);
      const direct = payments.filter((p) => p.destination_charge);
      const pending = payments.filter((p) => !p.destination_charge && p.status === "completed");

      const monthly: Record<string, { gross: number; fees: number; net: number; count: number }> = {};
      for (const p of payments) {
        const d = new Date(p.completed_at || p.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthly[k] ??= { gross: 0, fees: 0, net: 0, count: 0 };
        monthly[k].gross += net(p) + Number(p.application_fee || 0);
        monthly[k].fees += Number(p.application_fee || 0);
        monthly[k].net += net(p);
        monthly[k].count++;
      }

      return {
        success: true,
        dashboard: {
          account: {
            hasAccount: !!account?.stripe_account_id, payoutsEnabled: account?.payouts_enabled || false,
            onboardingComplete: account?.onboarding_complete || false, chargesEnabled: account?.charges_enabled || false,
            detailsSubmitted: account?.details_submitted || false, lastWebhookAt: account?.last_webhook_at || null,
          },
          summary: {
            totalReceived, totalFees, netReceived: totalReceived,
            directDeposits: direct.reduce((s, p) => s + net(p), 0), directDepositCount: direct.length,
            platformCollectCount: payments.length - direct.length,
            pendingAmount: pending.reduce((s, p) => s + net(p), 0),
            pendingTransfers: pending.length,
            totalTransferred: payments.filter((p) => p.status === "transferred").reduce((s, p) => s + net(p), 0),
            completedTransfers: payments.filter((p) => p.status === "transferred").length,
            paidAmount: totalReceived - pending.reduce((s, p) => s + net(p), 0),
            totalPayments: payments.length,
          },
          needs: (userNeeds || []).map((n) => {
            const np = payments.filter((p) => p.need_id === n.id);
            return {
              id: n.id, title: n.title, goalAmount: Number(n.goal_amount), raisedAmount: Number(n.raised_amount),
              status: n.status, contributorCount: n.contributor_count, category: n.category, createdAt: n.created_at,
              paymentsCount: np.length, directPayments: np.filter((p) => p.destination_charge).length,
            };
          }),
          monthlyData: Object.entries(monthly).sort(([a], [b]) => b.localeCompare(a)).map(([month, d]) => ({ month, ...d })),
          recentTransactions: payments.slice(0, 20).map((p) => ({
            id: p.id, amount: Number(p.amount), fee: Number(p.application_fee || 0), net: net(p),
            needTitle: p.need_title || "", needId: p.need_id, contributorName: p.contributor_name || "Anonymous",
            destinationCharge: p.destination_charge || false, webhookConfirmed: false,
            completedAt: p.completed_at || p.created_at, type: p.type || "contribution",
          })),
        },
      };
    }

    case "admin_check":
      return { success: true, isAdmin: ctx.isAdmin };

    case "admin_register":
      return { success: false, error: "Admin access is granted by the SpotMe team." };

    case "admin_stats":
      requireAdmin(ctx);
      return await adminStats();

    case "fetch_webhook_logs": {
      requireAdmin(ctx);
      const { data } = await db.from("webhook_logs").select("id, event_type, event_id, processed, error, created_at, payload")
        .order("created_at", { ascending: false }).limit(500);
      const all = (data || []).map((w) => ({
        id: w.id, stripeEventId: w.event_id, eventType: w.event_type, processed: !!w.processed,
        processingResult: w.processed ? "ok" : null, processingError: w.error || null,
        relatedPaymentId: w.payload?.data?.object?.metadata?.payment_id || null, relatedProfileId: null,
        stripeAccount: w.payload?.account || null, livemode: !!w.payload?.livemode,
        receivedAt: w.created_at, processedAt: w.processed ? w.created_at : null, data: null,
      }));
      const typeCounts: Record<string, number> = {};
      for (const e of all) typeCounts[e.eventType] = (typeCounts[e.eventType] || 0) + 1;
      const search = typeof body.search === "string" ? body.search.toLowerCase() : "";
      const events = all.filter((e) =>
        (body.processed === undefined || (body.processed ? e.processed : !!e.processingError)) &&
        (!body.eventType || body.eventType === "all" || e.eventType === body.eventType) &&
        (!search || e.eventType.includes(search) || e.stripeEventId.toLowerCase().includes(search)))
        .slice(0, Math.min(Number(body.limit) || 50, 200));
      return {
        success: true,
        events,
        summary: {
          totalEvents: all.length,
          processedCount: all.filter((e) => e.processed).length,
          failedCount: all.filter((e) => e.processingError).length,
          pendingCount: all.filter((e) => !e.processed && !e.processingError).length,
          typeCounts,
        },
      };
    }

    case "tip_analytics":
      requireAdmin(ctx);
      return await tipAnalytics();

    case "export_payout_csv": {
      requireAdmin(ctx);
      const { data: payments } = await db.from("payments").select("*")
        .in("status", ["completed", "transferring", "transferred"]).order("completed_at", { ascending: false });
      if (!payments?.length) return { success: true, csv: "No completed payments found" };
      const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const rows = payments.map((p) => [
        new Date(p.completed_at || p.created_at).toISOString().split("T")[0], p.amount, p.tip_amount || 0,
        p.recipient_receives || p.amount, esc(p.need_title), esc(p.contributor_name), p.mode, p.type, p.status,
      ].join(","));
      return { success: true, csv: "Date,Amount,Tip,Net,Need,Contributor,Mode,Type,Status\n" + rows.join("\n") };
    }

    case "check_amount": {
      // Amounts are computed server-side, so only the PaymentIntent's state matters here
      const { data: payment } = await db.from("payments").select("stripe_payment_intent_id, status")
        .eq("stripe_payment_intent_id", body.paymentIntentId).maybeSingle();
      if (!payment) return { success: false, error: "Payment not found" };
      const pi = await stripe("GET", `payment_intents/${payment.stripe_payment_intent_id}`);
      return { success: true, mismatch: false, expired: pi.status === "canceled", alreadySucceeded: pi.status === "succeeded" };
    }

    case "recover": {
      // Start a fresh PaymentIntent for the same donation (e.g. the old one was canceled)
      let q = db.from("payments").select("*");
      q = body.paymentId ? q.eq("id", body.paymentId) : q.eq("stripe_payment_intent_id", body.paymentIntentId);
      const { data: old } = await q.maybeSingle();
      if (!old) return { success: false, error: "Payment not found" };
      if ((old.contributor_id || null) !== ctx.uid) return { success: false, error: "Payment not found" };
      if (!["pending", "failed"].includes(old.status)) return { success: false, error: "This payment can no longer be restarted." };
      if (old.stripe_payment_intent_id) {
        const pi = await stripe("GET", `payment_intents/${old.stripe_payment_intent_id}`);
        if (pi.status === "succeeded") return { success: false, error: "This payment already went through." };
        if (pi.status !== "canceled") await stripe("POST", `payment_intents/${pi.id}/cancel`).catch(() => {});
      }
      await db.from("payments").update({ status: "canceled" }).eq("id", old.id).in("status", ["pending", "failed"]);
      const result = await stripeCheckout("create_checkout", {
        amount: old.amount, tipAmount: old.tip_amount, needId: old.need_id, note: old.note,
        isAnonymous: old.is_anonymous, type: old.type, spreadAllocations: old.spread_allocations,
        contributorName: old.contributor_name,
      }, ctx);
      if (!result.success) return result;
      return { ...result, paymentIntentId: String(result.clientSecret).split("_secret_")[0] };
    }

    case "fetch_payout_history": {
      const uid = requireUser(ctx);
      const { data: needs } = await db.from("needs").select("id").eq("user_id", uid);
      const ids = (needs || []).map((n) => n.id);
      const { data } = ids.length
        ? await db.from("payments").select("id, amount, need_id, need_title, status, destination_charge, completed_at, created_at")
          .in("need_id", ids).or("status.eq.transferred,and(status.eq.completed,destination_charge.eq.true)")
          .order("completed_at", { ascending: false }).limit(100)
        : { data: [] as any[] };
      return {
        success: true,
        payouts: (data || []).map((p) => ({
          id: p.id, amount: Number(p.amount), needId: p.need_id, needTitle: p.need_title || "",
          status: "paid", method: p.destination_charge ? "direct" : "transfer", date: p.completed_at || p.created_at,
        })),
      };
    }

    case "process_auto_payouts": {
      const uid = requireUser(ctx);
      const { account } = await syncConnectedAccount(uid);
      if (!account?.stripe_account_id || !account.onboarding_complete) {
        return { success: false, error: "Finish payout setup in Settings first." };
      }
      const { data: needs } = await db.from("needs").select("id").eq("user_id", uid);
      const r = await transferPendingFunds(uid, (needs || []).map((n) => n.id), account.stripe_account_id, "auto_payout");
      return { success: true, results: [], ...r };
    }

    case "set_auto_payout":
    case "check_auto_payout_config":
      // Donations to connected accounts are paid out by Stripe automatically
      return { success: true, enabled: true };

    case "resend_payout_receipt":
      return { success: false, error: "Payout receipts are sent by Stripe to the email on your payout account." };

    case "request_payout":
      return await processContribution("request_payout", body, ctx);

    // ---- Admin ----
    case "health_check":
      requireAdmin(ctx);
      return { success: true, status: "ok", stripeMode, time: new Date().toISOString() };

    case "fetch_error_logs": {
      requireAdmin(ctx);
      const { data } = await db.from("error_logs").select("*").order("created_at", { ascending: false })
        .limit(Math.min(Number(body.limit) || 100, 500));
      // Shape rows the way the admin screen reads them; severity/source live in metadata
      const errors = (data || []).map((e) => ({
        id: e.id, error_type: e.error_type || "client", message: e.message || "", stack_trace: e.stack || null,
        severity: e.metadata?.severity || "error", source: e.metadata?.source || e.url || "client",
        resolved: false, created_at: e.created_at, metadata: e.metadata,
      })).filter((e) => !body.severity || e.severity === body.severity);
      return { success: true, errors };
    }

    case "fetch_refundable_payments": {
      requireAdmin(ctx);
      const since = new Date(Date.now() - 120 * 86400000).toISOString();
      const { data } = await db.from("payments").select("*").eq("status", "completed").gte("completed_at", since)
        .order("completed_at", { ascending: false }).limit(200);
      return {
        success: true,
        payments: (data || []).map((p) => ({
          id: p.id, amount: Number(p.amount), tipAmount: Number(p.tip_amount || 0), needId: p.need_id,
          needTitle: p.need_title || "", contributorName: p.contributor_name || "Anonymous",
          createdAt: p.created_at, completedAt: p.completed_at, type: p.type, destinationCharge: p.destination_charge,
        })),
      };
    }

    case "fetch_refund_history": {
      requireAdmin(ctx);
      const { data } = await db.from("payments").select("*").eq("status", "refunded")
        .order("created_at", { ascending: false }).limit(200);
      return {
        success: true,
        refunds: (data || []).map((p) => ({
          id: p.id, paymentId: p.id, amount: Number(p.amount), needTitle: p.need_title || "",
          contributorName: p.contributor_name || "Anonymous", reason: p.failure_reason || "", createdAt: p.failed_at || p.created_at,
          status: "succeeded",
        })),
      };
    }

    case "process_refund": {
      requireAdmin(ctx);
      // Claim first so the same payment can't be refunded twice
      const { data: claimed } = await db.from("payments").update({ status: "refunding" })
        .eq("id", body.paymentId).eq("status", "completed").select("*");
      const p = claimed?.[0];
      if (!p) return { success: false, error: "Only completed payments that haven't been paid out can be refunded." };
      try {
        const refund = await stripe("POST", "refunds", {
          payment_intent: p.stripe_payment_intent_id,
          reason: ["duplicate", "fraudulent", "requested_by_customer"].includes(body.reason) ? body.reason : "requested_by_customer",
          ...(p.destination_charge ? { reverse_transfer: true, refund_application_fee: true } : {}),
          metadata: { payment_id: p.id, note: sanitize(body.note, 200) },
        }, `refund-${p.id}`);
        await db.from("payments").update({
          status: "refunded", failure_reason: sanitize(body.reason, 100) || "refunded", failed_at: new Date().toISOString(),
        }).eq("id", p.id);
        await reversePayment(p);
        return { success: true, refundId: refund.id };
      } catch (err) {
        await db.from("payments").update({ status: "completed" }).eq("id", p.id).eq("status", "refunding");
        return { success: false, error: (err as Error).message };
      }
    }

    case "log_client_error": {
      await db.from("error_logs").insert({
        error_type: sanitize(body.errorType, 50) || "client",
        message: sanitize(body.message, 1000),
        stack: String(body.stackTrace || body.stack || "").slice(0, 2000),
        url: String(body.url || "").slice(0, 500),
        user_agent: String(body.userAgent || "").slice(0, 500),
        user_id: ctx.uid,
        metadata: {
          ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
          severity: ["critical", "error", "warning", "info"].includes(body.severity) ? body.severity : "error",
        },
      });
      return { success: true };
    }
  }
  return { success: false, error: `Unknown stripe-checkout action: ${action}` };
}

async function adminStats() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [
    { data: profiles }, { data: needs }, { data: recentPayments }, { data: allPayments },
    { count: failedCount }, { count: recentNeedsCount }, { data: webhookData }, { data: errorData },
  ] = await Promise.all([
    db.from("profiles").select("id, name, avatar, city, verified, total_raised, total_given, created_at").order("created_at", { ascending: false }).limit(200),
    db.from("needs").select("id, title, category, goal_amount, raised_amount, status, contributor_count, created_at, user_id").order("created_at", { ascending: false }).limit(200),
    db.from("payments").select("id, amount, tip_amount, contributor_name, contributor_avatar, need_id, created_at, is_anonymous, destination_charge").in("status", ["completed", "transferring", "transferred"]).order("created_at", { ascending: false }).limit(200),
    db.from("payments").select("amount, tip_amount").in("status", ["completed", "transferring", "transferred"]),
    db.from("payments").select("*", { count: "exact", head: true }).eq("status", "failed"),
    db.from("needs").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    db.from("webhook_logs").select("processed, created_at").order("created_at", { ascending: false }).limit(500),
    db.from("error_logs").select("metadata").limit(500),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { weekday: "short" }), amount: 0, count: 0 };
  });
  for (const p of recentPayments || []) {
    const day = days.find((d) => d.date === (p.created_at || "").slice(0, 10));
    if (day) { day.amount = money(day.amount + Number(p.amount || 0)); day.count++; }
  }
  const categoryBreakdown: Record<string, { count: number; raised: number }> = {};
  for (const n of needs || []) {
    const c = n.category || "Other";
    categoryBreakdown[c] ??= { count: 0, raised: 0 };
    categoryBreakdown[c].count++;
    categoryBreakdown[c].raised += Number(n.raised_amount || 0);
  }
  const contributors: Record<string, { name: string; avatar: string; total: number; count: number }> = {};
  for (const p of recentPayments || []) {
    if (p.is_anonymous) continue;
    const k = p.contributor_name || "Anonymous";
    contributors[k] ??= { name: k, avatar: p.contributor_avatar || "", total: 0, count: 0 };
    contributors[k].total = money(contributors[k].total + Number(p.amount || 0));
    contributors[k].count++;
  }
  const wh = webhookData || [];
  const totalRaised = (allPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  return {
    success: true,
    stats: {
      totalUsers: (profiles || []).length,
      totalNeeds: (needs || []).length,
      activeNeeds: (needs || []).filter((n) => n.status === "Collecting").length,
      totalGoalsMet: (needs || []).filter((n) => n.status === "Goal Met").length,
      totalRaised, totalContributions: (allPayments || []).length, totalPayments: (allPayments || []).length,
      totalRevenue: money((allPayments || []).reduce((s, p) => s + Number(p.tip_amount || 0), 0)), failedPaymentsCount: failedCount || 0,
      recentContributionsCount: (recentPayments || []).filter((p) => p.created_at >= weekAgo).length,
      recentNeedsCount: recentNeedsCount || 0,
      webhookStats: {
        total: wh.length, processed: wh.filter((w) => w.processed === true).length,
        failed: wh.filter((w) => w.processed === false).length, pending: wh.filter((w) => w.processed == null).length,
      },
      errorStats: { total: (errorData || []).length, unresolved: (errorData || []).length, critical: 0 },
      dailyData: days,
      categoryBreakdown,
      topContributors: Object.values(contributors).sort((a, b) => b.total - a.total).slice(0, 10),
      recentTransactions: (recentPayments || []).slice(0, 20).map((p) => ({
        id: p.id, userName: p.is_anonymous ? "A kind stranger" : (p.contributor_name || "Anonymous"),
        userAvatar: p.contributor_avatar || "", amount: Number(p.amount || 0), needId: p.need_id || "",
        timestamp: p.created_at, isAnonymous: p.is_anonymous || false,
      })),
      users: (profiles || []).map((u) => ({
        id: u.id, name: u.name || "SpotMe User", avatar: u.avatar || "", city: u.city || "", verified: u.verified || false,
        totalRaised: Number(u.total_raised || 0), totalGiven: Number(u.total_given || 0), joinedDate: u.created_at,
      })),
      needs: (needs || []).map((n) => ({
        id: n.id, title: n.title || "", category: n.category || "Other", goalAmount: Number(n.goal_amount || 0),
        raisedAmount: Number(n.raised_amount || 0), status: n.status || "Collecting",
        contributorCount: n.contributor_count || 0, createdAt: n.created_at, userId: n.user_id,
      })),
    },
  };
}

async function tipAnalytics() {
  const { data } = await db.from("payments")
    .select("amount, tip_amount, created_at, contributor_name, contributor_id, is_anonymous, destination_charge")
    .in("status", ["completed", "transferring", "transferred"]).order("created_at", { ascending: false }).limit(500);
  const payments = data || [];
  const withTip = payments.filter((p) => Number(p.tip_amount || 0) > 0);
  const totalTips = withTip.reduce((s, p) => s + Number(p.tip_amount), 0);
  const tips = withTip.map((p) => Number(p.tip_amount)).sort((a, b) => a - b);
  const median = tips.length ? (tips.length % 2 ? tips[(tips.length - 1) / 2] : (tips[tips.length / 2 - 1] + tips[tips.length / 2]) / 2) : 0;
  const pcts = withTip.filter((p) => Number(p.amount) > 0).map((p) => (Number(p.tip_amount) / Number(p.amount)) * 100);

  const buckets: Record<string, number> = { "$0": payments.length - withTip.length, "$1": 0, "$2": 0, "$5": 0, "$10+": 0 };
  for (const p of withTip) {
    const t = Number(p.tip_amount);
    buckets[t >= 10 ? "$10+" : t >= 5 ? "$5" : t >= 2 ? "$2" : "$1"]++;
  }
  const daily: Record<string, { tipTotal: number; tipCount: number; total: number }> = {};
  for (let i = 13; i >= 0; i--) daily[new Date(Date.now() - i * 86400000).toISOString().split("T")[0]] = { tipTotal: 0, tipCount: 0, total: 0 };
  for (const p of payments) {
    const d = daily[(p.created_at || "").split("T")[0]];
    if (!d) continue;
    d.total++;
    if (Number(p.tip_amount || 0) > 0) { d.tipTotal += Number(p.tip_amount); d.tipCount++; }
  }
  const ranges: Record<string, { count: number; tipped: number; totalTips: number }> = {
    "$1–$25": { count: 0, tipped: 0, totalTips: 0 }, "$26–$50": { count: 0, tipped: 0, totalTips: 0 },
    "$51–$100": { count: 0, tipped: 0, totalTips: 0 }, "$100+": { count: 0, tipped: 0, totalTips: 0 },
  };
  for (const p of payments) {
    const a = Number(p.amount || 0), t = Number(p.tip_amount || 0);
    const r = ranges[a > 100 ? "$100+" : a > 50 ? "$51–$100" : a > 25 ? "$26–$50" : "$1–$25"];
    r.count++;
    if (t > 0) { r.tipped++; r.totalTips += t; }
  }
  const tippers: Record<string, { name: string; tipCount: number; totalTips: number; totalDonated: number }> = {};
  for (const p of withTip) {
    const k = p.contributor_id || p.contributor_name || "anon";
    tippers[k] ??= { name: p.is_anonymous ? "Anonymous" : (p.contributor_name || "Anonymous"), tipCount: 0, totalTips: 0, totalDonated: 0 };
    tippers[k].tipCount++;
    tippers[k].totalTips += Number(p.tip_amount);
    tippers[k].totalDonated += Number(p.amount);
  }

  return {
    success: true,
    tipAnalytics: {
      summary: {
        totalTips: money(totalTips), totalPayments: payments.length, paymentsWithTip: withTip.length,
        paymentsWithoutTip: payments.length - withTip.length,
        avgTip: money(withTip.length ? totalTips / withTip.length : 0), medianTip: money(median),
        avgTipPercent: pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : 0,
        tipRate: payments.length ? Math.round((withTip.length / payments.length) * 100) : 0,
        totalDonations: money(payments.reduce((s, p) => s + Number(p.amount || 0), 0)),
      },
      tipBuckets: buckets,
      dailyTipData: Object.entries(daily).map(([date, d]) => ({
        date, label: new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        tipTotal: money(d.tipTotal), tipCount: d.tipCount, tipRate: d.total ? Math.round((d.tipCount / d.total) * 100) : 0,
      })),
      tipByDonationRange: ranges,
      topTippers: Object.values(tippers).sort((a, b) => b.totalTips - a.totalTips).slice(0, 10),
      recentTips: withTip.slice(0, 20).map((p) => ({
        contributorName: p.is_anonymous ? "Anonymous" : (p.contributor_name || "Anonymous"),
        donationAmount: Number(p.amount), tipAmount: Number(p.tip_amount), date: p.created_at,
        destinationCharge: !!p.destination_charge,
      })),
    },
  };
}

// ============================================================
// stripe-connect
// ============================================================

async function stripeConnect(action: string, body: any, ctx: Ctx) {
  switch (action) {
    case "check_status": {
      const uid = requireUser(ctx);
      const { account } = await syncConnectedAccount(uid);
      if (!account?.stripe_account_id) return { success: true, hasAccount: false, onboardingComplete: false, payoutsEnabled: false };
      return {
        success: true, hasAccount: true, accountId: account.stripe_account_id,
        onboardingComplete: account.onboarding_complete, payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted,
      };
    }

    case "create_account": {
      const uid = requireUser(ctx);
      const { data: existing } = await db.from("connected_accounts").select("*").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
      if (existing?.stripe_account_id) {
        return { success: true, accountId: existing.stripe_account_id, onboardingComplete: existing.onboarding_complete || false, alreadyExists: true };
      }
      const profile = await getProfile(uid);
      const acct = await stripe("POST", "accounts", {
        type: "express",
        email: ctx.email || undefined,
        metadata: { user_id: uid, name: profile?.name || "" },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      }, `acct-${uid}`);
      await db.from("connected_accounts").upsert({
        user_id: uid, livemode: LIVEMODE, stripe_account_id: acct.id, onboarding_complete: false,
        payouts_enabled: false, charges_enabled: false, details_submitted: false,
      }, { onConflict: "user_id,livemode" });
      return { success: true, accountId: acct.id, onboardingComplete: false };
    }

    case "create_onboarding_link": {
      const uid = requireUser(ctx);
      const { data: account } = await db.from("connected_accounts").select("stripe_account_id").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
      if (!account?.stripe_account_id) {
        return { success: false, needsAccount: true, error: "No Stripe account found. Please tap Set Up to create your payout account first." };
      }
      const link = await stripe("POST", "account_links", {
        account: account.stripe_account_id,
        return_url: safeUrl(body.returnUrl, "/settings"),
        refresh_url: safeUrl(body.refreshUrl, "/settings"),
        type: "account_onboarding",
      });
      return { success: true, onboardingUrl: link.url };
    }

    case "complete_onboarding": {
      // Trust Stripe, not the client: only enable payouts once Stripe says the account is ready
      const uid = requireUser(ctx);
      const { account } = await syncConnectedAccount(uid);
      if (!account?.stripe_account_id) return { success: false, error: "No payout account found." };
      if (!account.onboarding_complete) {
        return { success: false, pending: true, error: "Stripe hasn't finished verifying your account yet. Please complete all steps, then try again." };
      }
      const { data: needs } = await db.from("needs").select("id").eq("user_id", uid);
      const r = await transferPendingFunds(uid, (needs || []).map((n) => n.id), account.stripe_account_id, "auto_transfer_on_onboarding");
      if (r.transferred > 0) {
        await notify(uid, { type: "payout", title: "Your funds are on the way!", message: `$${r.totalDollars.toFixed(2)} has been transferred to your bank account. Arrives in 2–3 business days.` });
      }
      return { success: true, autoTransferred: r.transferred, autoFailed: r.failed, autoTotalDollars: r.totalDollars };
    }

    case "create_login_link": {
      const uid = requireUser(ctx);
      const { data: account } = await db.from("connected_accounts").select("stripe_account_id, onboarding_complete").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
      if (!account?.stripe_account_id || !account.onboarding_complete) return { success: false, error: "Finish payout setup first." };
      const link = await stripe("POST", `accounts/${account.stripe_account_id}/login_links`);
      return { success: true, url: link.url, loginUrl: link.url };
    }

    case "get_payout_summary": {
      const uid = requireUser(ctx);
      const { data: needs } = await db.from("needs").select("id").eq("user_id", uid);
      const ids = (needs || []).map((n) => n.id);
      const { data } = ids.length
        ? await db.from("payments").select("amount, recipient_receives, destination_charge, status").in("need_id", ids)
        : { data: [] as any[] };
      const payments = data || [];
      const net = (p: any) => Number(p.recipient_receives || p.amount || 0);
      const received = payments.filter((p) => ["completed", "transferring", "transferred"].includes(p.status));
      const pendingPayout = payments.filter((p) => p.status === "completed" && !p.destination_charge);
      const paid = payments.filter((p) => p.status === "transferred" || (p.status === "completed" && p.destination_charge));
      const direct = received.filter((p) => p.destination_charge);
      return {
        success: true,
        summary: {
          totalRaised: received.reduce((s, p) => s + net(p), 0),
          totalReceived: received.reduce((s, p) => s + net(p), 0),
          pendingPayout: pendingPayout.reduce((s, p) => s + net(p), 0),
          paidOut: paid.reduce((s, p) => s + net(p), 0),
          directPaymentsCount: direct.length,
          directPaymentsReceived: direct.reduce((s, p) => s + net(p), 0),
          paymentCount: received.length,
        },
      };
    }

    case "get_bank_info": {
      const uid = requireUser(ctx);
      const { data: account } = await db.from("connected_accounts").select("stripe_account_id").eq("user_id", uid).eq("livemode", LIVEMODE).maybeSingle();
      if (!account?.stripe_account_id) return { success: true, bankInfo: null };
      const list = await stripe("GET", `accounts/${account.stripe_account_id}/external_accounts`, { object: "bank_account", limit: 1 });
      const bank = list?.data?.[0];
      return {
        success: true,
        bankInfo: bank ? {
          bankName: bank.bank_name || null, last4: bank.last4 || null, routingNumber: null,
          currency: bank.currency || "usd", country: bank.country || "US",
          accountHolderName: bank.account_holder_name || null, status: bank.status || "new",
          type: bank.object, isDefault: !!bank.default_for_currency,
        } : null,
      };
    }

    case "check_stripe_config":
      requireAdmin(ctx);
      return {
        success: true,
        config: {
          mode: stripeMode, isTestMode: stripeMode === "test", hasSecretKey: stripeMode !== "unknown",
          hasWebhookSecret: !!Deno.env.get("STRIPE_WEBHOOK_SECRET"), connectEnabled: true,
        },
      };

    case "get_recipient_account": {
      if (!body.needId) return { success: false, error: "needId required" };
      const { data: need } = await db.from("needs").select("user_id").eq("id", body.needId).maybeSingle();
      if (!need) return { success: true, needNotFound: true };
      const { data: acct } = await db.from("connected_accounts")
        .select("stripe_account_id, onboarding_complete, payouts_enabled").eq("user_id", need.user_id).eq("livemode", LIVEMODE).maybeSingle();
      return {
        success: true, hasAccount: !!acct?.stripe_account_id, onboardingComplete: acct?.onboarding_complete || false,
        payoutsEnabled: acct?.payouts_enabled || false,
      };
    }
  }
  return { success: false, error: `Unknown stripe-connect action: ${action}` };
}

// ============================================================
// process-contribution (needs, profiles, comments, ...)
// ============================================================

async function processContribution(action: string, body: any, ctx: Ctx) {
  switch (action) {
    case "fetch_needs": {
      await expireNeeds();
      let query = db.from("needs").select("*").neq("status", "Deleted");
      query = ctx.uid
        ? query.or(`verification_status.eq.approved,user_id.eq.${ctx.uid}`)
        : query.eq("verification_status", "approved");
      const { data: needs } = await query.order("created_at", { ascending: false }).limit(100);
      const list = needs || [];
      const userIds = [...new Set(list.map((n) => n.user_id).filter(Boolean))];
      const needIds = list.map((n) => n.id);
      const [{ data: profiles }, { data: contributions }] = await Promise.all([
        userIds.length ? db.from("profiles").select("id, name, avatar, city, verified, trust_score, trust_level").in("id", userIds) : { data: [] as any[] },
        needIds.length ? db.from("contributions").select("*").in("need_id", needIds).order("created_at", { ascending: false }).limit(2000) : { data: [] as any[] },
      ]);
      const pMap = new Map((profiles || []).map((p) => [p.id, p]));
      const cMap = new Map<string, any[]>();
      for (const c of contributions || []) {
        const arr = cMap.get(c.need_id) ?? [];
        if (arr.length < 20) arr.push(c);
        cMap.set(c.need_id, arr);
      }
      return { success: true, needs: list.map((n) => mapNeed(n, pMap.get(n.user_id) || {}, cMap.get(n.id) || [])) };
    }

    case "fetch_need_by_id": {
      const { data: need } = await db.from("needs").select("*").eq("id", body.needId).neq("status", "Deleted").maybeSingle();
      if (!need || (need.verification_status !== "approved" && need.user_id !== ctx.uid && !ctx.isAdmin)) {
        return { success: false, error: "Need not found" };
      }
      const [profile, { data: contributions }] = await Promise.all([
        need.user_id ? getProfile(need.user_id) : null,
        db.from("contributions").select("*").eq("need_id", need.id).order("created_at", { ascending: false }),
      ]);
      return { success: true, need: mapNeed(need, profile || {}, contributions || []) };
    }

    case "create_need": {
      const uid = requireUser(ctx);
      const profile = await getProfile(uid);
      if (!profile) throw new HttpError("Profile not found");
      const title = sanitize(body.title, 100);
      const message = sanitize(body.message, 1000);
      const goal = money(body.goalAmount);
      if (title.length < 3) throw new HttpError("Please add a title");
      if (!message) throw new HttpError("Please describe your need");
      if (goal < 5 || goal > 300) throw new HttpError("Goal must be between $5 and $300");
      const { count } = await db.from("needs").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("status", "Collecting").gt("expires_at", new Date().toISOString());
      if ((count || 0) >= MAX_ACTIVE_NEEDS) throw new HttpError(`You can have up to ${MAX_ACTIVE_NEEDS} active needs at a time.`);

      const { data: need, error } = await db.from("needs").insert({
        user_id: uid,
        title,
        message,
        category: CATEGORIES.includes(body.category) ? body.category : "Other",
        goal_amount: goal,
        photo: typeof body.photo === "string" ? body.photo.slice(0, 1000) : "",
        user_name: profile.name,
        user_avatar: profile.avatar || "",
        user_city: profile.city || "",
        status: "Collecting",
        verification_status: "pending",
        raised_amount: 0,
        contributor_count: 0,
        expires_at: new Date(Date.now() + NEED_LIFETIME_MS).toISOString(),
      }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, need: mapNeed(need, profile) };
    }

    case "edit_need": {
      const need = await ownedNeed(ctx, body.needId);
      if (need.status !== "Collecting") return { success: false, error: "Can only edit needs that are still collecting" };
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) updates.title = sanitize(body.title, 100);
      if (body.message !== undefined) updates.message = sanitize(body.message, 1000);
      if (body.photo !== undefined) updates.photo = String(body.photo).slice(0, 1000);
      if (body.goalAmount !== undefined && (need.contributor_count || 0) === 0) {
        const goal = money(body.goalAmount);
        if (goal < 5 || goal > 300) return { success: false, error: "Goal must be between $5 and $300" };
        updates.goal_amount = goal;
      }
      const { error } = await db.from("needs").update(updates).eq("id", need.id);
      if (error) return { success: false, error: "Failed to update need: " + error.message };
      return { success: true, updates };
    }

    case "delete_need": {
      const need = await ownedNeed(ctx, body.needId);
      if (Number(need.raised_amount) > 0) {
        return { success: false, error: "Cannot delete a need that has received contributions. Contact support for help." };
      }
      await db.from("notifications").delete().eq("need_id", need.id);
      const { error } = await db.from("needs").delete().eq("id", need.id);
      if (error) {
        const { error: softErr } = await db.from("needs").update({ status: "Deleted" }).eq("id", need.id);
        if (softErr) return { success: false, error: "Failed to delete need. Please try again later." };
      }
      return { success: true };
    }

    case "request_payout": {
      const uid = requireUser(ctx);
      const need = await ownedNeed(ctx, body.needId);
      if (need.user_id !== uid) throw new HttpError("You can only request payouts for your own needs");
      if (!PAYOUT_STATUSES.includes(need.status)) {
        return { success: false, error: "You can withdraw once your need reaches its goal." };
      }
      const { account } = await syncConnectedAccount(uid);
      if (!account?.stripe_account_id || !account.onboarding_complete) {
        await db.from("needs").update({ status: "Payout Requested" }).eq("id", need.id).eq("status", "Goal Met");
        return { success: true, needsSetup: true, message: "Payout request recorded. Please complete your Stripe payout setup in Settings to receive your funds." };
      }
      const r = await transferPendingFunds(uid, [need.id], account.stripe_account_id, "manual_payout_request");
      const { count: remaining } = await db.from("payments").select("id", { count: "exact", head: true })
        .eq("need_id", need.id).eq("status", "completed").eq("destination_charge", false);
      await db.from("needs").update({ status: (remaining || 0) === 0 && r.failed === 0 ? "Paid" : "Payout Requested" }).eq("id", need.id);
      if (r.transferred > 0) {
        await notify(uid, { type: "payout", title: "Payout sent!", message: `$${r.totalDollars.toFixed(2)} is on its way to your bank account. Arrives in 2–3 business days.`, need_id: need.id });
      }
      return {
        success: true,
        message: r.transferred > 0
          ? `$${r.totalDollars.toFixed(2)} transferred to your bank account. Arrives in 2–3 business days.`
          : r.failed > 0 ? "Some transfers failed. Please contact support." : "No eligible payments found for payout.",
        ...r,
      };
    }

    case "update_profile": {
      const uid = requireUser(ctx);
      const u = body.updates || {};
      const updates: Record<string, string> = {};
      if (typeof u.name === "string" && u.name.trim()) updates.name = sanitize(u.name, 80);
      if (u.bio !== undefined) updates.bio = sanitize(u.bio, 500);
      if (u.city !== undefined) updates.city = sanitize(u.city, 100);
      if (u.avatar !== undefined) updates.avatar = String(u.avatar).slice(0, 1000);
      if (Object.keys(updates).length === 0) return { success: true };
      const { error } = await db.from("profiles").update(updates).eq("id", uid);
      if (error) return { success: false, error: error.message };

      const needSync: Record<string, string> = {};
      if (updates.name) needSync.user_name = updates.name;
      if (updates.avatar !== undefined) needSync.user_avatar = updates.avatar;
      if (updates.city !== undefined) needSync.user_city = updates.city;
      if (Object.keys(needSync).length) await db.from("needs").update(needSync).eq("user_id", uid);
      if (updates.avatar !== undefined) await db.from("contributions").update({ user_avatar: updates.avatar }).eq("user_id", uid).eq("is_anonymous", false);
      if (updates.name) await db.from("contributions").update({ user_name: updates.name }).eq("user_id", uid).eq("is_anonymous", false);
      // Comments, activity, payments and thank-you videos also carry a copy, so the new photo shows everywhere
      if (updates.avatar !== undefined) {
        await Promise.all([
          db.from("need_comments").update({ user_avatar: updates.avatar }).eq("user_id", uid),
          db.from("activity_feed").update({ user_avatar: updates.avatar }).eq("user_id", uid),
          db.from("thankyou_videos").update({ user_avatar: updates.avatar }).eq("user_id", uid),
          db.from("payments").update({ contributor_avatar: updates.avatar }).eq("contributor_id", uid).eq("is_anonymous", false),
        ]);
      }
      const profile = await getProfile(uid);
      return { success: true, profile: profile ? profileToUser(profile) : null };
    }

    case "delete_account": {
      // Store requirement: users can delete their account in-app. Financial records
      // (payments) are kept but anonymized; personal data and the login are removed.
      const uid = requireUser(ctx);
      if (ctx.isAdmin) return { success: false, error: "Admin accounts can't be deleted from the app." };

      const { data: myNeeds } = await db.from("needs").select("id, raised_amount, status").eq("user_id", uid);
      const needIds = (myNeeds || []).map((n) => n.id);
      if (needIds.length) {
        const { data: owed } = await db.from("payments").select("amount")
          .in("need_id", needIds).in("status", ["completed", "transferring"]).eq("destination_charge", false);
        const total = (owed || []).reduce((s, p) => s + Number(p.amount), 0);
        if (total > 0) {
          return { success: false, error: `You have $${total.toFixed(2)} waiting to be paid out. Request your payout before deleting your account.` };
        }
      }

      const { data: subs } = await db.from("spotters").select("stripe_subscription_id").eq("user_id", uid).eq("status", "active");
      for (const sub of subs || []) {
        if (sub.stripe_subscription_id) await stripe("DELETE", `subscriptions/${sub.stripe_subscription_id}`).catch(() => {});
      }

      const gone = "Former member";
      const emptyNeeds = (myNeeds || []).filter((n) => Number(n.raised_amount) === 0).map((n) => n.id);
      if (emptyNeeds.length) {
        await db.from("notifications").delete().in("need_id", emptyNeeds);
        await db.from("needs").delete().in("id", emptyNeeds);
      }
      await db.from("needs").update({ user_name: gone, user_avatar: "", user_city: "", status: "Deleted" })
        .eq("user_id", uid).eq("status", "Collecting");
      await db.from("needs").update({ user_name: gone, user_avatar: "", user_city: "" }).eq("user_id", uid);
      await db.from("contributions").update({ user_id: null, user_name: "A kind stranger", user_avatar: "", is_anonymous: true }).eq("user_id", uid);
      await db.from("payments").update({ contributor_id: null, contributor_name: "A kind stranger", contributor_avatar: "" }).eq("contributor_id", uid);
      await db.from("need_comments").update({ user_id: null, user_name: gone, user_avatar: "" }).eq("user_id", uid);
      await db.from("activity_feed").update({ user_id: null, user_name: gone, user_avatar: "" }).eq("user_id", uid);
      await db.from("thankyou_videos").delete().eq("user_id", uid);
      await db.from("notifications").delete().eq("user_id", uid);
      await db.from("push_subscriptions").delete().eq("user_id", uid);
      await db.from("verification_requests").delete().eq("user_id", uid);
      await db.from("connected_accounts").delete().eq("user_id", uid);
      await db.from("receipts").update({ user_id: null }).eq("user_id", uid);
      await db.from("spotters").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("user_id", uid);
      await db.from("profiles").update({
        name: "Deleted user", email: null, avatar: "", bio: "", city: "", verified: false, spotter_tier: null,
      }).eq("id", uid);

      // Remove the user's uploaded photos (stored under <bucket>/<uid>/...)
      for (const bucket of ["avatars", "need-photos"]) {
        const { data: files } = await db.storage.from(bucket).list(uid, { limit: 1000 });
        if (files?.length) await db.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`));
      }

      const { error } = await db.auth.admin.deleteUser(uid);
      if (error) {
        console.error("[delete_account] auth delete failed:", error.message);
        return { success: false, error: "Could not finish deleting your account. Please contact support." };
      }
      return { success: true };
    }

    case "get_profile": {
      const uid = requireUser(ctx);
      const profile = await getProfile(uid);
      if (!profile) return { success: false, error: "Profile not found" };
      // Lets the profile show "under review" after the user sends a verification request
      const { data: vreq } = profile.verified ? { data: null } : await db.from("verification_requests")
        .select("status").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { success: true, profile: { ...profileToUser(profile), verificationRequest: vreq?.status || null } };
    }

    case "fetch_receipts": {
      const uid = requireUser(ctx);
      const { data } = await db.from("payments").select("*").eq("contributor_id", uid)
        .in("status", ["completed", "transferring", "transferred"]).order("completed_at", { ascending: false }).limit(50);
      const { data: receipts } = await db.from("receipts").select("payment_id, receipt_number").eq("user_id", uid);
      const numbers = new Map((receipts || []).map((r) => [r.payment_id, r.receipt_number]));
      return {
        success: true,
        receipts: (data || []).map((p) => ({
          id: p.id, receiptNumber: numbers.get(p.id) || `SM-${p.id.slice(0, 8).toUpperCase()}`,
          amount: Number(p.amount), tipAmount: Number(p.tip_amount || 0), needTitle: p.need_title,
          needId: p.need_id, date: p.completed_at || p.created_at, status: "completed",
        })),
      };
    }

    case "fetch_trust_score": {
      const profile = typeof body.userId === "string" ? await getProfile(body.userId) : null;
      if (!profile) return { success: false, error: "Profile not found" };
      const score = profile.trust_score || 0;
      const ageDays = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;
      return {
        success: true,
        trustScore: score,
        trustLevel: score >= 80 ? "trusted" : score >= 40 ? "established" : "new",
        factors: {
          accountAge: { score: Math.min(Math.round(ageDays / 3), 20), max: 20 },
          verification: { score: profile.verified ? 20 : 0, max: 20 },
          contributions: { score: Math.min(Number(profile.total_given || 0) * 2, 30), max: 30 },
          reports: { score: 30, max: 30 },
        },
        profile: { name: profile.name, joinedDate: profile.created_at, verified: profile.verified },
      };
    }

    case "fetch_activity": {
      const { data } = await db.from("activity_feed").select("*").order("created_at", { ascending: false })
        .limit(Math.min(Number(body.limit) || 20, 100));
      return {
        success: true,
        activities: (data || []).map((a) => ({
          id: a.id, type: a.type, userId: a.user_id, userName: a.user_name, userAvatar: a.user_avatar,
          needId: a.need_id, needTitle: a.need_title, amount: a.amount ? Number(a.amount) : null,
          message: a.message, createdAt: a.created_at,
        })),
      };
    }

    case "fetch_impact_stats": {
      const { data } = await db.from("needs").select("raised_amount, status, contributor_count").neq("status", "Deleted");
      const n = data || [];
      return {
        success: true,
        stats: {
          totalRaised: n.reduce((s, x) => s + Number(x.raised_amount), 0),
          totalSpots: n.reduce((s, x) => s + (x.contributor_count || 0), 0),
          goalsCompleted: n.filter((x) => ["Goal Met", "Payout Requested", "Paid"].includes(x.status)).length,
          activeNeeds: n.filter((x) => x.status === "Collecting").length,
          totalNeeds: n.length,
        },
      };
    }

    case "check_need_limit": {
      const uid = requireUser(ctx);
      const { count } = await db.from("needs").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("status", "Collecting").gt("expires_at", new Date().toISOString());
      const active = count || 0;
      return { success: true, activeCount: active, maxAllowed: MAX_ACTIVE_NEEDS, canCreate: active < MAX_ACTIVE_NEEDS, remaining: Math.max(0, MAX_ACTIVE_NEEDS - active) };
    }

    case "report": {
      const uid = requireUser(ctx);
      await db.from("reports").insert({
        reporter_id: uid, need_id: body.needId || null, user_id: body.userId || null,
        reason: sanitize(body.reason, 100), details: sanitize(body.details, 1000), status: "open",
      });
      return { success: true };
    }

    case "mark_read":
      return await markRead(body, ctx);

    case "post_comment": {
      const uid = requireUser(ctx);
      const message = sanitize(body.message, 1000);
      if (!message) return { success: false, error: "Comment message is required" };
      const { data: need } = await db.from("needs").select("id, title, user_id").eq("id", body.needId).maybeSingle();
      if (!need) return { success: false, error: "Need not found" };
      let parent: any = null;
      if (body.parentCommentId) {
        ({ data: parent } = await db.from("need_comments").select("id, need_id, user_id, user_name").eq("id", body.parentCommentId).maybeSingle());
        if (!parent || parent.need_id !== need.id) return { success: false, error: "Parent comment not found" };
      }
      const profile = await getProfile(uid);
      const name = profile?.name || "SpotMe User";
      const avatar = profile?.avatar || "";
      const { data: comment, error } = await db.from("need_comments").insert({
        need_id: need.id, user_id: uid, user_name: name, user_avatar: avatar, message,
        parent_comment_id: parent?.id ?? null,
      }).select().single();
      if (error) return { success: false, error: "Failed to post comment: " + error.message };

      const snippet = `"${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`;
      if (need.user_id && need.user_id !== uid) {
        await notify(need.user_id, {
          type: "comment", title: parent ? "New Reply" : "New Comment",
          message: `${name} ${parent ? "replied on" : "commented on"} "${need.title}": ${snippet}`, need_id: need.id, avatar,
        });
      }
      if (parent?.user_id && parent.user_id !== uid && parent.user_id !== need.user_id) {
        await notify(parent.user_id, {
          type: "comment_reply", title: "New Reply",
          message: `${name} replied to your comment on "${need.title}": ${snippet}`, need_id: need.id, avatar,
        });
      }
      await db.from("activity_feed").insert({
        type: "comment", user_id: uid, user_name: name, user_avatar: avatar, need_id: need.id, need_title: need.title,
        message: parent ? `replied to ${parent.user_name}'s comment on "${need.title}"` : `commented on "${need.title}"`,
      });
      return {
        success: true,
        comment: {
          id: comment.id, needId: comment.need_id, userId: comment.user_id, userName: comment.user_name,
          userAvatar: comment.user_avatar, message: comment.message, parentCommentId: comment.parent_comment_id,
          parentUserName: parent?.user_name || null, createdAt: comment.created_at,
        },
      };
    }

    case "fetch_comments": {
      if (!body.needId) return { success: false, error: "Missing needId" };
      const limit = Math.min(Number(body.limit) || 10, 50);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const [{ data: top }, { count: totalTop }, { count: totalAll }] = await Promise.all([
        db.from("need_comments").select("*").eq("need_id", body.needId).is("parent_comment_id", null)
          .order("created_at", { ascending: false }).range(offset, offset + limit - 1),
        db.from("need_comments").select("id", { count: "exact", head: true }).eq("need_id", body.needId).is("parent_comment_id", null),
        db.from("need_comments").select("id", { count: "exact", head: true }).eq("need_id", body.needId),
      ]);
      const ids = (top || []).map((c) => c.id);
      const { data: replies } = ids.length
        ? await db.from("need_comments").select("*").in("parent_comment_id", ids).order("created_at")
        : { data: [] as any[] };
      const map = (c: any) => ({
        id: c.id, needId: c.need_id, userId: c.user_id, userName: c.user_name, userAvatar: c.user_avatar,
        message: c.message, parentCommentId: c.parent_comment_id || null, createdAt: c.created_at,
      });
      return {
        success: true,
        comments: (top || []).map((c) => {
          const r = (replies || []).filter((x) => x.parent_comment_id === c.id).map(map);
          return { ...map(c), replyCount: r.length, replies: r };
        }),
        total: totalTop || 0,
        totalAll: totalAll || 0,
        hasMore: offset + limit < (totalTop || 0),
      };
    }

    // ---- Admin moderation ----
    case "verify_need":
    case "admin_review_need": {
      requireAdmin(ctx);
      const approve = body.verificationAction === "approve" || body.approve === true;
      if (approve) {
        // A need only goes live once its poster can actually receive the money
        const { data: pending } = await db.from("needs").select("user_id").eq("id", body.needId).maybeSingle();
        if (!pending) return { success: false, error: "Need not found" };
        const { account, live } = pending.user_id ? await syncConnectedAccount(pending.user_id) : { account: null, live: null };
        if (!account?.stripe_account_id) return { success: false, error: "This person hasn't connected a Stripe payout account yet." };
        if (!live) return { success: false, error: "Couldn't reach their payout account on Stripe. Check Stripe status in the Overview tab." };
        if (!account.onboarding_complete) return { success: false, error: "Their Stripe payout setup isn't finished yet." };
      }
      const updates: Record<string, unknown> = { verification_status: approve ? "approved" : "rejected", updated_at: new Date().toISOString() };
      if (action === "admin_review_need") updates.status = approve ? "Collecting" : "Expired";
      if (approve) updates.expires_at = new Date(Date.now() + NEED_LIFETIME_MS).toISOString();
      const { data: need } = await db.from("needs").update(updates).eq("id", body.needId).select("user_id, title").maybeSingle();
      if (need?.user_id) {
        await notify(need.user_id, approve
          ? { type: "milestone", title: "Your need is live!", message: `"${need.title}" was verified and is now on SpotMe.`, need_id: body.needId }
          : { type: "welcome", title: "Need not approved", message: `"${need.title}" wasn't approved. Reply to our email or contact support for details.`, need_id: body.needId });
      }
      return { success: true, newStatus: updates.verification_status };
    }

    case "admin_stripe_status": {
      // Which Stripe account the server's key belongs to, and whether users' payout accounts live in it
      requireAdmin(ctx);
      let platform: any, balance: any;
      try {
        balance = await stripe("GET", "balance");
      } catch (err) {
        return { success: false, error: `Stripe rejected the server's key (${stripeKeyKind}) on a balance check: ${(err as Error).message}` };
      }
      try {
        platform = await stripe("GET", "account");
      } catch (err) {
        return { success: false, error: `The key (${stripeKeyKind}) works, but Stripe won't say which account it belongs to: ${(err as Error).message}` };
      }
      const { data: accounts } = await db.from("connected_accounts").select("user_id, stripe_account_id, onboarding_complete").eq("livemode", LIVEMODE);
      const results = await Promise.all((accounts || []).filter((a) => a.stripe_account_id).map(async (a) => {
        try {
          const acct = await stripe("GET", `accounts/${a.stripe_account_id}`);
          return { userId: a.user_id, accountId: a.stripe_account_id, found: true, payoutsEnabled: !!acct.payouts_enabled, transfers: acct.capabilities?.transfers || "inactive" };
        } catch (err) {
          return { userId: a.user_id, accountId: a.stripe_account_id, found: false, error: (err as Error).message };
        }
      }));
      const names = new Map(((await db.from("profiles").select("id, name").in("id", results.map((r) => r.userId))).data || []).map((p) => [p.id, p.name]));
      return {
        success: true,
        platform: {
          id: platform.id,
          name: platform.settings?.dashboard?.display_name || platform.business_profile?.name || "",
          email: platform.email || "",
          livemode: !!balance.livemode,
        },
        connected: results.map((r) => ({ ...r, name: names.get(r.userId) || "Unknown" })),
      };
    }

    case "fetch_pending_needs": {
      requireAdmin(ctx);
      const { data } = await db.from("needs").select("*").in("verification_status", ["pending", "flagged", "info_requested"])
        .order("created_at", { ascending: true });
      const userIds = [...new Set((data || []).map((n) => n.user_id).filter(Boolean))];
      const [{ data: profiles }, { data: accounts }] = userIds.length
        ? await Promise.all([
          db.from("profiles").select("id, name, avatar, city, email").in("id", userIds),
          db.from("connected_accounts").select("user_id, onboarding_complete").in("user_id", userIds).eq("livemode", LIVEMODE),
        ])
        : [{ data: [] as any[] }, { data: [] as any[] }];
      const pMap = new Map((profiles || []).map((p) => [p.id, p]));
      const payoutReady = new Set((accounts || []).filter((a) => a.onboarding_complete).map((a) => a.user_id));
      return {
        success: true,
        needs: (data || []).map((n) => ({
          payoutReady: payoutReady.has(n.user_id),
          id: n.id, userId: n.user_id, userName: n.user_name || "Unknown", userAvatar: n.user_avatar || "",
          title: n.title, message: n.message, category: n.category, goalAmount: Number(n.goal_amount),
          photo: n.photo, verificationStatus: n.verification_status, createdAt: n.created_at,
          goal_amount: Number(n.goal_amount), created_at: n.created_at, user_id: n.user_id,
          profiles: pMap.get(n.user_id) || null,
        })),
      };
    }

    case "request_verification": {
      const uid = requireUser(ctx);
      const name = sanitize(body.name, 80), phone = sanitize(body.phone, 20), city = sanitize(body.city, 80);
      if (name.length < 2 || phone.replace(/\D/g, "").length < 10 || city.length < 2) {
        throw new HttpError("Please enter your name, a valid phone number and your city.");
      }
      const { data: open } = await db.from("verification_requests").select("id").eq("user_id", uid).eq("status", "pending").maybeSingle();
      const row = { name, phone, city, status: "pending" };
      const { error } = open
        ? await db.from("verification_requests").update(row).eq("id", open.id)
        : await db.from("verification_requests").insert({ user_id: uid, ...row });
      if (error) throw new Error(error.message);
      return { success: true };
    }

    case "admin_list_verifications": {
      requireAdmin(ctx);
      const { data } = await db.from("verification_requests").select("*").order("created_at", { ascending: false }).limit(50);
      const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await db.from("profiles").select("id, name, avatar, city").in("id", userIds)
        : { data: [] as any[] };
      const pMap = new Map((profiles || []).map((p) => [p.id, p]));
      return { success: true, requests: (data || []).map((r) => ({ ...r, profiles: pMap.get(r.user_id) || null })) };
    }

    case "admin_review_verification": {
      requireAdmin(ctx);
      const approve = body.verificationAction === "approve";
      const { data: req } = await db.from("verification_requests").update({
        status: approve ? "approved" : "rejected", notes: sanitize(body.notes, 500), reviewed_at: new Date().toISOString(),
      }).eq("id", body.requestId).select("user_id").maybeSingle();
      if (approve && req?.user_id) {
        await db.from("profiles").update({ verified: true }).eq("id", req.user_id);
        await notify(req.user_id, { type: "milestone", title: "You're SpotMe Verified!", message: "Your checkmark now shows on your profile and every post." });
      }
      return { success: true };
    }

    // ---- Removed: these recorded money that was never charged ----
    case "contribute":
    case "spread_the_love":
      return { success: false, error: "Contributions must go through secure checkout." };

    case "create_profile":
    case "login":
    case "change_password":
    case "migrate_need_owner":
      return { success: false, error: "This action has moved to Supabase Auth." };

    case "list_payment_methods":
      return { success: true, paymentMethods: [] };
    case "add_payment_method":
    case "remove_payment_method":
      return { success: false, error: "Cards are entered securely at checkout and aren't stored by SpotMe." };
  }
  return { success: false, error: `Unknown action: ${action}` };
}

async function markRead(body: any, ctx: Ctx) {
  const uid = requireUser(ctx);
  if (body.markAll) {
    await db.from("notifications").update({ read: true }).eq("user_id", uid);
  } else if (Array.isArray(body.notificationIds) && body.notificationIds.length) {
    await db.from("notifications").update({ read: true }).eq("user_id", uid).in("id", body.notificationIds);
  }
  return { success: true };
}

// ============================================================
// send-notification
// ============================================================

async function sendNotification(action: string, body: any, ctx: Ctx) {
  switch (action) {
    case "fetch_notifications": {
      const uid = requireUser(ctx);
      const { data } = await db.from("notifications").select("*").eq("user_id", uid)
        .order("created_at", { ascending: false }).limit(50);
      return {
        success: true,
        notifications: (data || []).map((n) => ({
          id: n.id, type: n.type, title: n.title, message: n.message, timestamp: n.created_at,
          read: n.read, needId: n.need_id, avatar: n.avatar,
        })),
      };
    }
    case "mark_read":
      return await markRead(body, ctx);
    case "subscribe": {
      const uid = requireUser(ctx);
      if (body.subscription?.endpoint) {
        await db.from("push_subscriptions").upsert({
          user_id: uid, endpoint: String(body.subscription.endpoint).slice(0, 1000), keys: body.subscription.keys,
        }, { onConflict: "endpoint" });
      }
      return { success: true };
    }
    case "unsubscribe": {
      const uid = requireUser(ctx);
      if (body.endpoint) await db.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", uid);
      return { success: true };
    }
    case "broadcast":
      requireAdmin(ctx);
      return { success: true };
  }
  return { success: false, error: `Unknown action: ${action}` };
}

// ============================================================
// upload-thankyou-video
// ============================================================

async function thankYouVideo(action: string, body: any, ctx: Ctx) {
  switch (action) {
    case "get_by_need": {
      const { data } = await db.from("thankyou_videos").select("*").eq("need_id", body.needId).order("created_at", { ascending: false }).limit(10);
      return { success: true, videos: data || [] };
    }
    case "get_by_user": {
      const { data } = await db.from("thankyou_videos").select("*").eq("user_id", body.userId).order("created_at", { ascending: false }).limit(20);
      return { success: true, videos: data || [] };
    }
    case "get_by_id": {
      const { data } = await db.from("thankyou_videos").select("*").eq("id", body.videoId).maybeSingle();
      if (data) await db.from("thankyou_videos").update({ views: (data.views || 0) + 1 }).eq("id", data.id);
      return { success: true, video: data };
    }
    case "track_like":
    case "track_share": {
      const col = action === "track_like" ? "likes" : "shares";
      const { data } = await db.from("thankyou_videos").select(`id, ${col}`).eq("id", body.videoId).maybeSingle();
      if (data) await db.from("thankyou_videos").update({ [col]: ((data as any)[col] || 0) + 1 }).eq("id", data.id);
      return { success: true };
    }
    case "upload": {
      const need = await ownedNeed(ctx, body.needId);
      const profile = await getProfile(ctx.uid!);
      const { data, error } = await db.from("thankyou_videos").insert({
        need_id: need.id, user_id: ctx.uid, need_title: need.title, user_name: profile?.name || "",
        user_avatar: profile?.avatar || "", video_url: String(body.videoUrl || "").slice(0, 1000),
        thumbnail_url: String(body.thumbnailUrl || "").slice(0, 1000), message: sanitize(body.message, 500),
      }).select().single();
      if (error) return { success: false, error: error.message };
      return { success: true, video: data };
    }
  }
  return { success: true };
}

// ============================================================
// spotter-subscription
// ============================================================

async function spotterSubscription(action: string, body: any, ctx: Ctx) {
  switch (action) {
    case "create_spotter_subscription": {
      const uid = requireUser(ctx);
      const tier = SPOTTER_TIERS[body.tier];
      if (!tier) return { success: false, error: "Invalid tier." };
      const session = await stripe("POST", "checkout/sessions", {
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: tier.name, description: "Community Spotter — monthly giving" },
            recurring: { interval: "month" },
            unit_amount: tier.amount * 100,
          },
          quantity: 1,
        }],
        metadata: { tier: body.tier, user_id: uid },
        subscription_data: { metadata: { tier: body.tier, user_id: uid } },
        customer_email: ctx.email || undefined,
        success_url: `${safeUrl(body.origin, "").replace(/\/$/, "")}/spotter-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: safeUrl(body.cancelUrl, "/spotter-tiers"),
      });
      return { success: true, url: session.url, sessionId: session.id };
    }

    case "confirm_spotter_subscription": {
      const uid = requireUser(ctx);
      if (!body.sessionId) return { success: false, error: "No session ID provided." };
      const session = await stripe("GET", `checkout/sessions/${body.sessionId}`, { expand: ["subscription"] });
      if (session.metadata?.user_id !== uid) return { success: false, error: "This subscription belongs to another account." };
      if (session.payment_status !== "paid" && session.status !== "complete") return { success: false, error: "Payment not completed yet." };
      const sub = session.subscription;
      const subscriptionId = typeof sub === "string" ? sub : sub?.id;
      const tier = session.metadata?.tier || "";
      if (subscriptionId) {
        await db.from("spotters").upsert({
          user_id: uid,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id: subscriptionId,
          tier,
          amount: (session.amount_total || 0) / 100,
          status: "active",
          current_period_end: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        }, { onConflict: "stripe_subscription_id" });
        await db.from("profiles").update({ spotter_tier: tier }).eq("id", uid);
      }
      return { success: true, tier, subscriptionId };
    }

    case "cancel_spotter_subscription": {
      const uid = requireUser(ctx);
      const { data: spotter } = await db.from("spotters").select("id, stripe_subscription_id, user_id").eq("id", body.spotterId).maybeSingle();
      if (!spotter?.stripe_subscription_id || spotter.user_id !== uid) return { success: false, error: "Subscription not found." };
      await stripe("DELETE", `subscriptions/${spotter.stripe_subscription_id}`);
      await db.from("spotters").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", spotter.id);
      await db.from("profiles").update({ spotter_tier: null }).eq("id", uid);
      return { success: true };
    }
  }
  return { success: false, error: `Unknown spotter action: ${action}` };
}

// ============================================================
// Router
// ============================================================

const HANDLERS: Record<string, (action: string, body: any, ctx: Ctx) => Promise<any>> = {
  "stripe-checkout": stripeCheckout,
  "stripe-connect": stripeConnect,
  "process-contribution": processContribution,
  "send-notification": sendNotification,
  "upload-thankyou-video": thankYouVideo,
  "spotter-subscription": spotterSubscription,
  "track-walkthrough": async (action) => action === "fetch_stats"
    ? { success: true, stats: { totalViews: 0, completionRate: 0, avgDuration: 0 } }
    : { success: true },
  "upload-avatar": async () => ({ success: false, error: "Avatars upload directly to storage." }),
  "recover-payment": stripeCheckout,
  "auto-expire": async () => ({ success: true, expiredCount: await expireNeeds(), emailsSent: 0 }),
  "send-receipt-email": async (action, _body, ctx) => {
    if (action === "fetch_history") {
      const r = ctx.uid ? await processContribution("fetch_receipts", {}, ctx) : { receipts: [] };
      return { success: true, receipts: r.receipts || [] };
    }
    return { success: false, error: "Stripe emails your receipt automatically after each payment." };
  },
  "link-guest-payment": async (_action, body, ctx) => {
    // Attach recent guest checkouts made on this device to the account that just signed in
    const uid = requireUser(ctx);
    const ids = (Array.isArray(body.paymentIds) ? body.paymentIds : []).filter((x: unknown) => typeof x === "string").slice(0, 20);
    if (!ids.length) return { success: true, linked: 0 };
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await db.from("payments").update({ contributor_id: uid })
      .in("id", ids).is("contributor_id", null).gte("created_at", since).select("amount, status");
    const given = (data || []).filter((p) => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
    if (given > 0) {
      const { data: me } = await db.from("profiles").select("total_given").eq("id", uid).maybeSingle();
      await db.from("profiles").update({ total_given: money(Number(me?.total_given || 0) + given) }).eq("id", uid);
    }
    return { success: true, linked: data?.length || 0 };
  },
  "stripe-webhook": async (_action, _body, ctx) => {
    requireAdmin(ctx);
    return { success: false, error: "Detailed analytics aren't available yet. See the Admin dashboard for stats." };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return respond({ success: false, error: "Method not allowed" }, 405);

  let fn = "", action = "";
  try {
    const payload = await req.json();
    fn = String(payload?.fn || "");
    const body = payload?.body && typeof payload.body === "object" ? payload.body : {};
    action = String(body.action || "");
    const handler = HANDLERS[fn];
    if (!handler) return respond({ success: false, error: `Unknown function: ${fn}` }, 404);
    const ctx = await getCtx(req);
    return respond(await handler(action, body, ctx));
  } catch (err) {
    if (err instanceof HttpError) return respond({ success: false, error: err.message });
    console.error(`[api] ${fn}/${action} failed:`, (err as Error).message);
    return respond({ success: false, error: "Something went wrong. Please try again." }, 500);
  }
});
