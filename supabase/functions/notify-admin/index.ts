import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

  const ADMIN_EMAILS = ['thehallsales@gmail.com', 'vargas122@gmail.com'];
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
  const APP_URL = 'https://spotmeone.com';

  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
      const { needId, title, message, goalAmount, userName, userCity, category } = await req.json();

      if (!RESEND_API_KEY) {
        console.error('[notify-admin] RESEND_API_KEY not set');
        return new Response(JSON.stringify({ error: 'Email not configured' }), { status: 500 });
      }

      const adminUrl = `${APP_URL}?tab=admin&section=approvals`;
      const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(goalAmount ?? 0);

      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0ebe6;">
          <div style="background:#e07b54;padding:24px 28px;">
            <div style="color:#fff;font-size:20px;font-weight:800;">SpotMe — New Need for Review 🧡</div>
            <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">Someone needs your approval to go live</div>
          </div>
          <div style="padding:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#9b7e6a;font-size:12px;width:110px;">From</td><td style="padding:8px 0;font-weight:600;color:#2d1f14;">${userName}${userCity ? ' · ' + userCity : ''}</td></tr>
              <tr><td style="padding:8px 0;color:#9b7e6a;font-size:12px;">Need</td><td style="padding:8px 0;font-weight:700;color:#2d1f14;font-size:15px;">${title}</td></tr>
              <tr><td style="padding:8px 0;color:#9b7e6a;font-size:12px;">Amount</td><td style="padding:8px 0;font-weight:600;color:#e07b54;">${formattedAmount}</td></tr>
              <tr><td style="padding:8px 0;color:#9b7e6a;font-size:12px;">Category</td><td style="padding:8px 0;color:#2d1f14;">${category}</td></tr>
            </table>
            ${message ? `<div style="background:#fdf8f5;border-left:3px solid #e07b54;border-radius:0 8px 8px 0;padding:12px 16px;margin:16px 0;font-size:14px;color:#3d2b1f;line-height:1.6;">${message}</div>` : ''}
            <a href="${adminUrl}" style="display:inline-block;background:#e07b54;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">Review in Admin Panel →</a>
          </div>
          <div style="background:#faf8f6;padding:16px 28px;font-size:11px;color:#9b7e6a;border-top:1px solid #f0ebe6;">
            SpotMe · No tragedy. Just life. · <a href="${APP_URL}" style="color:#e07b54;text-decoration:none;">spotmeone.com</a>
          </div>
        </div>
      `;

      const results = await Promise.all(
        ADMIN_EMAILS.map(to =>
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'SpotMe <notifications@spotmeone.com>',
              to,
              subject: `New Need for Review: "${title}" — ${formattedAmount}`,
              html,
            }),
          }).then(r => r.json())
        )
      );

      const allOk = results.every(r => r.id);
      return new Response(JSON.stringify({ success: allOk, results }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      console.error('[notify-admin] Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  });
  