# Edge Functions — Cron Setup

External scheduler: [cron-job.org](https://cron-job.org).

## Required cron jobs

| Function | Schedule | Method | Headers |
|---|---|---|---|
| `whatsapp-sequence-runner` | Every hour | POST | `x-cron-secret: <CRON_SECRET>` |
| `funnel-exit-detector` | Every hour | POST | `x-cron-secret: <CRON_SECRET>` |

URL format:
```
https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>
```

Both functions check `CRON_SECRET` from edge-function env. Set it once in
Supabase → Project Settings → Edge Functions → Secrets, and use the same
value in cron-job.org's "Headers" tab.

## Razorpay webhook

In Razorpay dashboard → Webhooks:
- URL: `https://<PROJECT_REF>.supabase.co/functions/v1/razorpay-webhook`
- Events: `payment.captured`, `payment.failed`, `order.paid`,
  `subscription.activated`, `subscription.charged`,
  `subscription.cancelled`, `subscription.completed`
- Secret: paste into `payment_provider_settings.webhook_secret`
  (Admin → Settings → Payments tab). Fallback: `RAZORPAY_WEBHOOK_SECRET`
  env var.
