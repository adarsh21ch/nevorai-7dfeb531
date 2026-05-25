# Plan: Funnel Engagement + Razorpay Webhook + Meta Pixel CAPI

A big shipment. Before I touch code I want your sign-off on scope, because a couple of items in the brief conflict with what's already in the repo and would create silent regressions if I just blindly built them.

---

## What's already there (and what I'll reuse)

- `whatsapp_templates`, `whatsapp_automations`, `whatsapp_automation_steps`, `whatsapp_sequence_enrollments`, `whatsapp_leads` — built last turn.
- `supabase/functions/whatsapp-sequence-runner` — cron runner already exists.
- `supabase/functions/whatsapp-webhook` — already enrolls leads in `funnel_lead_captured` automations.
- `supabase/functions/razorpay-webhook` — **already exists** and is wired to `RAZORPAY_WEBHOOK_SECRET` / `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` env vars. It handles subscription provisioning. I will NOT replace it — I'll **extend** it to also (a) read keys from the new `payment_provider_settings` table with env fallback, and (b) fire the WhatsApp invoice + Meta `Purchase` event on `payment.captured`.
- `supabase/functions/razorpay-portal` — checkout/order creation. Same: extend to read keys from DB with env fallback.
- `/admin/settings` (`AdminSettingsPage`) — exists, will add **Payments** and **Meta Pixel** tabs.
- Public funnel viewer (`PublicFunnel.tsx`) — will add 25/50/75/100% + exit beacons.

---

## Migration (single file: `supabase/migrations/<ts>_engagement_payments_pixel.sql`)

Tables:
1. `funnel_engagement_events` — public insert via service-role edge fn, admin select. Index `(funnel_id, session_id, event_type)`, plus `(session_id, created_at desc)` for the exit scanner. Add `followup_sent_at timestamptz` on the same table (not a separate "sessions" table — keep it simple, scanner writes a synthetic `followup_sent` row OR we add `followup_sent_at` to a small `funnel_engagement_sessions` rollup. **Decision:** add a tiny `funnel_engagement_sessions(session_id pk, funnel_id, viewer_phone, last_event, last_event_at, followup_sent_at)` updated by the log function — much cheaper to scan than the events table.
2. `payment_provider_settings` — single row enforced via `CHECK (id = '00000000-0000-0000-0000-000000000001')`. Admin RW only.
3. `payment_webhook_log` — service-role write, admin read.
4. `meta_pixel_settings` — single-row, admin RW.
5. `meta_pixel_events_log` — service-role write, admin read.

Seeds:
- New template `Payment Confirmation` (category=onboarding).
- New automation `Funnel Dropoff Followup` (trigger `funnel_dropoff`) with 2 steps (immediate + 24h).

RLS: admin = `has_role(auth.uid(),'admin')`, reusing the existing helper.

**Note on "encrypted at rest":** Postgres at-rest is already encrypted by Supabase. I will NOT add app-level encryption (key management would be a whole other feature). The secret stays plaintext in the row, gated by RLS + admin-only API. I'll document this. Tell me if you want pgsodium instead and I'll add it.

---

## Edge Functions (new)

1. **`funnel-engagement-log`** — public POST, no auth. Rate-limit by IP using an in-memory LRU (100/min). Inserts event + upserts session rollup.
2. **`funnel-exit-detector`** — `CRON_SECRET` header. Scans `funnel_engagement_sessions` where `last_event IN ('progress_50','progress_75')` AND `last_event_at < now() - interval '1 hour'` AND `last_event_at > now() - interval '24 hours'` AND `followup_sent_at IS NULL` AND `viewer_phone IS NOT NULL`. Enrolls into `funnel_dropoff` automation, stamps `followup_sent_at`.
3. **`meta-pixel-fire`** — service-role-only (checks `Authorization: Bearer <service_role>` OR is invoked via `supabase.functions.invoke` from another edge fn). Hashes PII (email/phone SHA-256, lowercased) per CAPI spec. Reads pixel_id/token from `meta_pixel_settings`. Logs every call.

## Edge Functions (extended, not replaced)

4. **`razorpay-webhook`** — patch: load `payment_provider_settings` row at top; use its `webhook_secret` to verify (env var as fallback for backward compat). On `payment.captured`, after existing provisioning logic: call `whatsapp-send-text` with `Payment Confirmation` template variables resolved, enroll user in `Post-Subscription Onboarding` automation if it exists, and invoke `meta-pixel-fire` with event `Purchase` + value/currency. Log to `payment_webhook_log` (idempotent on `event_id`).
5. **`razorpay-portal`** — patch: load DB settings and prefer them over env when building Razorpay Basic auth header.

## Frontend hooks for Meta Pixel

- `PublicFunnel` lead submit → invoke `meta-pixel-fire` with `Lead`.
- `PublicFunnel` first video play → `ViewContent`.
- Auth signup handler (`useAuth` / wherever signup succeeds) → `CompleteRegistration`.
- Razorpay webhook → `Purchase` (server-side, above).

---

## Admin UI

`/admin/settings` gets two new tabs added to the existing Tabs:

- **Payments**: form for `key_id` / `key_secret` / `webhook_secret` / `is_active`, masked inputs with show/hide, copy-to-clipboard webhook URL, "Test webhook" button (POSTs a fake signed event to the function and shows the response), "Last updated by X on Y".
- **Meta Pixel**: `pixel_id` / `access_token` / `test_event_code` / `is_active`, "Send test event" button, table of last 20 `meta_pixel_events_log` rows with success badges and timestamps.

Both tabs follow the same Card + Form + toast pattern as the WhatsApp tabs.

---

## Funnel viewer changes (`PublicFunnel.tsx`)

- Generate/persist `session_id` in `sessionStorage`.
- On video element: `timeupdate` → fire 25/50/75 milestone events once each, `ended` → `completed`.
- `beforeunload` + `visibilitychange:hidden` → `navigator.sendBeacon` an `exit` event.
- Lead submit handler also POSTs `lead_submitted` (in addition to existing lead creation).

---

## Deliverables checklist

- [ ] 1 migration SQL file (6 tables incl. session rollup, RLS, seeds)
- [ ] 3 new edge functions + 2 patched ones
- [ ] 2 new admin tabs under `/admin/settings`
- [ ] Patches: `PublicFunnel.tsx` (engagement + pixel), auth signup (pixel), `razorpay-portal` (DB-backed keys)
- [ ] `supabase/functions/README.md` with cron-job.org setup for `funnel-exit-detector`

---

## Things I'm flagging — please confirm before I build

1. **Don't replace existing `razorpay-webhook`** — extend it. Confirm? (Replacing would break live subscription provisioning.)
2. **DB credentials with env fallback** — if `payment_provider_settings` row is missing/inactive, fall back to existing env vars so nothing breaks during rollout. OK?
3. **Pixel from browser vs server** — brief says "server-side via CAPI". I'll do server-side only (no `fbq` browser tag added). Confirm.
4. **No app-level encryption** for the secret columns (relying on Supabase at-rest + RLS). OK, or do you want pgsodium?
5. **Funnel exit detector window** — I'll only follow up if last engagement was 1h–24h ago AND viewer_phone is known. Anonymous sessions get logged but never messaged. OK?
6. **"Post-Subscription Onboarding" automation** — brief says "already exists" but I don't see it seeded. I'll auto-enroll only IF an active automation with `trigger='subscription_activated'` (or similar) exists; otherwise skip silently. OK?

Reply "go" (or with answers to the above) and I'll ship it in one pass.