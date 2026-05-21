# Fix: Landing page confirmation emails not sending

## Root cause (confirmed)

The plan-gate added in `send-landing-page-confirmation` last turn is blocking 100% of sends because:

1. **The SQL migration was never applied to Supabase.** The column `plan_config.feature_landing_page_email` does not exist in the live database, so the gate returns `plan_upgrade_required` for everyone — free, basic, and pro.
2. **The plan resolution logic in the edge function is too strict.** It only accepts `status = 'active'` + `tier != 'free'` + non-expired. Real paid users on trials, lifetime plans, or rows with `expires_at = null` will silently resolve to `'free'` and be blocked even after the migration runs.

The admin "Send Test Email" works because it calls `send-gmail-email` directly and never touches this gate.

## The fix (structural, not a bandaid)

### Step 1 — Apply the database migration

Run the existing `feature_landing_page_email_migration.sql` in Supabase so the column exists with correct values:

```sql
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS feature_landing_page_email boolean NOT NULL DEFAULT false;
UPDATE public.plan_config SET feature_landing_page_email = true  WHERE plan_name IN ('basic','pro');
UPDATE public.plan_config SET feature_landing_page_email = false WHERE plan_name = 'free';
```

Done as a migration so it's permanent and visible.

### Step 2 — Make the plan gate fail-OPEN, not fail-CLOSED

This is the critical structural change. The current code defaults to blocking when anything is uncertain. We invert that:

- **If the column doesn't exist, or the lookup errors, or the plan can't be resolved → send the email.** Worst case a free user gets a confirmation email — not a paying customer losing leads.
- Only block when we have an **explicit, unambiguous** `feature_landing_page_email = false` for a resolved plan.

### Step 3 — Use the same plan-resolution rule the rest of the app uses

Instead of re-implementing subscription logic inside the edge function (which is what caused the trial/lifetime edge cases), broaden the query:
- Accept `status in ('active','trialing')`
- Treat `expires_at IS NULL` as not-expired (lifetime/perpetual)
- If multiple subs exist, pick the one with the highest tier, not just the newest

### Step 4 — Add observable logging

Add `console.log` lines at every decision point in the gate:
- which `ownerId` we got
- which `planName` we resolved
- the raw `planCfg` row
- the final decision (`sent` / `plan_upgrade_required`)

So if it ever misbehaves again, one look at Supabase function logs tells us exactly which step is wrong — no guessing.

### Step 5 — Surface the real reason in `submit-landing-page-registration`

The submit function already captures `email_delivery.reason` from the response. We'll make sure that reason is logged on the server side (it already is) and confirm the UI's "mail sent" toast is only shown when `email_delivery.sent === true`, not on plain submit success. This way the user never again sees a false "email sent" confirmation while it silently failed.

## Files to change

- `feature_landing_page_email_migration.sql` — move into `supabase/migrations/` with proper timestamp so it actually runs
- `supabase/functions/send-landing-page-confirmation/index.ts` — rewrite the plan gate to fail-open, broaden plan resolution, add logging
- `src/pages/PublicLandingPage.tsx` (or wherever the toast is) — only show "email sent" when `email_delivery.sent === true`; otherwise show a neutral "Registration received" toast

## What will NOT change

- `send-gmail-email` edge function — untouched
- Gmail OAuth flow — untouched
- Resend email path — untouched
- Admin Settings test-email button — untouched (already working)
- The UI lock + upgrade prompt on the landing page editor toggle — untouched

## Verification after deploy

1. Run migration → confirm column exists with `SELECT plan_name, feature_landing_page_email FROM plan_config;`
2. Submit a registration on a paid user's landing page → email arrives, logs show `sent=true`
3. Submit a registration on a free user's landing page → no email, logs show `plan_upgrade_required` with the resolved plan name
4. Temporarily break the lookup (e.g. wrong plan name) → email still sends (fail-open), logs show the warning
