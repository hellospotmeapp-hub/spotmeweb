import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";
import { onPaymentCompleted } from "../_shared/payments.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  // Pinned API version; newer than the SDK's bundled type
  apiVersion: "2024-04-10" as Stripe.LatestApiVersion,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("[stripe-webhook] Missing signature or webhook secret");
    return new Response("Unauthorized", { status: 401 });
  }

  let event: Stripe.Event;
  const body = await req.text();
  const webhookSecret2 = Deno.env.get("STRIPE_WEBHOOK_SECRET_2");

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    if (webhookSecret2) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret2);
      } catch (err2) {
        console.error("[stripe-webhook] Both signature verifications failed:", err2);
        return new Response(`Webhook signature verification failed`, { status: 400 });
      }
    } else {
      return new Response(`Webhook signature verification failed`, { status: 400 });
    }
  }

  console.log(`[stripe-webhook] Received: ${event.type} (${event.id})`);

  try {
    await supabase.from("webhook_logs").upsert({
      event_type: event.type,
      event_id: event.id,
      payload: event,
      processed: false,
    }, { onConflict: "event_id" });

    await handleEvent(event);

    await supabase.from("webhook_logs")
      .update({ processed: true })
      .eq("event_id", event.id);

  } catch (err) {
    console.error(`[stripe-webhook] Handler error:`, err);
    await supabase.from("webhook_logs").upsert({
      event_type: event.type,
      event_id: event.id,
      payload: event,
      processed: false,
      error: String(err),
    }, { onConflict: "event_id" });
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      let { data: payment } = await supabase.from("payments").select("id")
        .eq("stripe_payment_intent_id", pi.id).maybeSingle();
      if (!payment && pi.metadata?.payment_id) {
        ({ data: payment } = await supabase.from("payments").select("id").eq("id", pi.metadata.payment_id).maybeSingle());
      }
      if (!payment) {
        console.warn(`[stripe-webhook] No payment row for ${pi.id}`);
        break;
      }
      // Completes the payment exactly once, even if the app already confirmed it
      const { data: completedNow, error } = await supabase.rpc("spotme_fulfill_payment", { p_payment_id: payment.id });
      if (error) throw new Error(error.message);
      if (completedNow) await onPaymentCompleted(supabase, payment.id);
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase.from("payments").update({
        status: "failed",
        failure_reason: pi.last_payment_error?.message || "Payment failed",
        failure_code: pi.last_payment_error?.code || "unknown",
        failed_at: new Date().toISOString(),
      })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending");
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await supabase.from("connected_accounts").update({
        payouts_enabled: account.payouts_enabled || false,
        charges_enabled: account.charges_enabled || false,
        details_submitted: account.details_submitted || false,
        onboarding_complete: !!(account.details_submitted && account.charges_enabled),
        last_webhook_at: new Date().toISOString(),
      }).eq("stripe_account_id", account.id);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier || "community";
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? "";
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? "";

      if (userId && subscriptionId) {
        await supabase.from("spotters").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          tier,
          status: "active",
        }, { onConflict: "stripe_subscription_id" });

        await supabase.from("profiles")
          .update({ spotter_tier: tier })
          .eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // spotters.status only allows active / past_due / cancelled
      const status = ["active", "trialing"].includes(sub.status) ? "active"
        : ["canceled", "incomplete_expired"].includes(sub.status) ? "cancelled"
        : "past_due";

      await supabase.from("spotters").update({
        status,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      }).eq("stripe_subscription_id", sub.id);

      if (sub.status !== "active" && sub.status !== "trialing") {
        const { data: spotter } = await supabase
          .from("spotters")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .single();

        if (spotter?.user_id) {
          await supabase.from("profiles")
            .update({ spotter_tier: null })
            .eq("id", spotter.user_id);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      const { data: spotter } = await supabase
        .from("spotters")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .single();

      await supabase.from("spotters").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", sub.id);

      if (spotter?.user_id) {
        await supabase.from("profiles")
          .update({ spotter_tier: null })
          .eq("id", spotter.user_id);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id ?? "";

      if (subscriptionId) {
        await supabase.from("spotters").update({
          status: "past_due",
        }).eq("stripe_subscription_id", subscriptionId);
      }
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
  }
}