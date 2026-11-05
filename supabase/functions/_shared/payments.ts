import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Side effects for a freshly completed payment (in-app notifications)
export async function onPaymentCompleted(db: SupabaseClient, paymentId: string) {
  const { data: p } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!p) return;
  const allocations: { needId: string; amount: number }[] = p.type === "spread"
    ? (typeof p.spread_allocations === "string" ? JSON.parse(p.spread_allocations) : p.spread_allocations) || []
    : p.need_id ? [{ needId: p.need_id, amount: Number(p.amount) }] : [];
  const who = p.is_anonymous ? "A kind stranger" : (p.contributor_name || "Someone");

  for (const a of allocations) {
    const { data: need } = await db.from("needs").select("user_id, title, status, goal_amount").eq("id", a.needId).maybeSingle();
    if (!need) continue;
    await db.from("notifications").insert({
      user_id: need.user_id, type: "contribution", title: "New Spot!",
      message: `${who} spotted $${Number(a.amount).toFixed(2)} on "${need.title}"`,
      need_id: a.needId, avatar: p.is_anonymous ? "" : (p.contributor_avatar || ""),
    });
    if (need.status === "Goal Met") {
      await db.from("notifications").insert({
        user_id: need.user_id, type: "goal_met", title: "Goal Met!",
        message: `Congratulations! "${need.title}" reached its $${Number(need.goal_amount)} goal!`,
        need_id: a.needId,
      });
    }
    await db.from("activity_feed").insert({
      type: "contribution", user_id: p.is_anonymous ? null : p.contributor_id, user_name: who,
      user_avatar: p.is_anonymous ? "" : (p.contributor_avatar || ""), need_id: a.needId,
      need_title: need.title, amount: a.amount, message: `spotted $${Number(a.amount).toFixed(2)} on "${need.title}"`,
    });
  }
}
