// Minimal Stripe REST client (form-encoded), keyed by the STRIPE_SECRET_KEY secret.
// Switching test <-> live mode is just changing that secret.

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

function encode(params: Record<string, unknown>, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") encode(item as Record<string, unknown>, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      encode(v as Record<string, unknown>, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export async function stripe(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<any> {
  if (!STRIPE_KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  const body = params ? encode(params).join("&") : "";
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_KEY}` };
  if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(url, { method, headers, body: method === "GET" ? undefined : body });
  const json = await res.json();
  if (!res.ok || json?.error) {
    const e = json?.error || {};
    const detail = [e.code, e.param && `param: ${e.param}`, res.headers.get("request-id")].filter(Boolean).join(", ");
    throw new Error(`${e.message || `Stripe request failed (${res.status})`}${detail ? ` [${detail}]` : ""}`);
  }
  return json;
}

// Key kind without the secret part, e.g. "sk_live", "rk_live", "sk_org"
export const stripeKeyKind = STRIPE_KEY.split("_").slice(0, 2).join("_") || "missing";

export const stripeMode = STRIPE_KEY.startsWith("sk_live") ? "live" : STRIPE_KEY.startsWith("sk_test") ? "test" : "unknown";
