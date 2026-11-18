// Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
// Secrets: RESEND_API_KEY (required to send) and EMAIL_FROM, e.g. "SpotMeOne <hello@spotmeone.com>".
// The sending domain must be verified in Resend. Without a key, emails are skipped, never thrown.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "SpotMeOne <hello@spotmeone.com>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") ?? "";

export const emailEnabled = !!RESEND_API_KEY;

export type EmailResult = { sent: boolean; id?: string; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { sent: false, error: "RESEND_API_KEY not set" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.to)) return { sent: false, error: "Invalid email address" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(EMAIL_REPLY_TO ? { reply_to: EMAIL_REPLY_TO } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, error: data?.message || `Resend HTTP ${res.status}` };
    return { sent: true, id: data?.id };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Simple, mobile-friendly layout with one call-to-action button.
export function buttonEmail(opts: { preheader: string; heading: string; paragraphs: string[]; buttonText: string; buttonUrl: string; footer?: string }) {
  const p = opts.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#2D2926">${escapeHtml(t)}</p>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#F2785C">SpotMeOne</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#2D2926">${escapeHtml(opts.heading)}</h1>
${p}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:999px;background:#F2785C">
<a href="${escapeHtml(opts.buttonUrl)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none">${escapeHtml(opts.buttonText)}</a>
</td></tr></table>
<p style="margin:0;font-size:13px;line-height:20px;color:#7A746E">${escapeHtml(opts.footer || "You're getting this because you posted a need on SpotMeOne.")}</p>
</td></tr></table>
</td></tr></table></body></html>`;
  const text = `${opts.heading}\n\n${opts.paragraphs.join("\n\n")}\n\n${opts.buttonText}: ${opts.buttonUrl}\n\n${opts.footer || "You're getting this because you posted a need on SpotMeOne."}`;
  return { html, text };
}
