# SpotMe

**No tragedy. Just life.** A micro-mutual-aid platform for everyday needs.

## Admin Dashboard

Access at `/admin`. The first signed-in user to visit can register as admin. After that, only registered admins can access the dashboard.

## Enforced Rate Limits

All API endpoints are rate-limited per user ID (authenticated) or per IP (anonymous). Exceeding limits returns HTTP 429.

| Action | Limit | Window |
|---|---|---|
| Create Need | 3 requests | 60 min |
| Contribute | 20 requests | 60 min |
| Create Account | 5 requests | 60 min |
| Report | 10 requests | 60 min |
| Browse Needs | 120 requests | 5 min |
| Stripe Checkout | 10 requests | 15 min |
| Payment Retry | 5 requests | 30 min |
| Admin Stats | 30 requests | 5 min |
| CSV Export | 5 requests | 15 min |
| Default (other) | 60 requests | 5 min |

## Security Configuration

- **RLS**: Row Level Security enabled on all tables
- **Admin Access**: Controlled via `admin_users` table; first user self-registers, subsequent admins must be added by existing admins
- **Input Validation**: UUID validation, HTML/XSS stripping, amount bounds ($0.01–$10,000), string length limits
- **API Keys**: All secrets (GATEWAY_API_KEY, SUPABASE_SERVICE_ROLE_KEY) are server-side only in edge functions
- **Error Monitoring**: Client errors logged via `error_logs` table; global error/unhandledrejection handlers on web
- **Database Indexes**: 41 indexes across all tables for query performance
- **Trust Score System**: Automatic scoring (0–100) based on account age, verification, contributions, and reports
- **Need Verification**: Auto-approved for trusted users (score ≥ 40); pending review for new users
- **Contribution Receipts**: Unique receipt numbers generated for every contribution
- **Payment Retries**: Up to 3 automatic retries on failed payments
- **Push Notifications**: Web Push API with VAPID keys

## Stripe Configuration

- Payment Gateway: `stripe.gateway.fastrouter.io`
- Platform fee: 5% (destination charges for connected accounts)
- Webhook endpoint: Active with event logging and retry support
