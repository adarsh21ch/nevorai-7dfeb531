## Goal

Restore the two-transport email architecture you described:

- **Resend** → platform/system emails sent from Nevorai itself
- **Gmail (creator-connected)** → lead-facing emails tied to a creator's funnel

My last fix wrongly forced *all* emails through Gmail. That's why system emails (welcome, receipts) and lead emails are both behaving inconsistently. This plan reverts that and routes each email type through the correct transport.

## Routing matrix

| Email | Trigger | Transport | From |
|---|---|---|---|
| Welcome / signup | User signs up on Nevorai | **Resend** | Nevorai system address |
| Payment receipt | Successful Razorpay/Stripe payment | **Resend** | Nevorai system address |
| Payment reminder | Subscription due / failed | **Resend** | Nevorai system address |
| OTP / auth codes | Login / verification | **Resend** (or Supabase auth) | Nevorai system address |
| Invoice | Billing event | **Resend** | Nevorai system address |
| **Lead confirmation** (prospect) | Lead submits funnel/landing form | **Creator's Gmail** | Creator's Gmail address |
| **Lead alert** (to creator) | Lead submits funnel/landing form | **Creator's Gmail** | Creator's own Gmail (self-send) |

## Changes

### 1. `src/routes/api/public/email/send.ts` — rewrite transport selection

- Reintroduce a `sendViaResend()` helper that posts to Resend API using `RESEND_API_KEY` env var (already exists in project — will verify with `fetch_secrets`).
- Keep `sendViaGmail()` as-is (calls `send-gmail-email` Supabase edge function).
- Route by payload `type`:
  - `welcome`, `receipt`, `reminder`, `invoice`, `otp` → `sendViaResend()`
  - `lead` (both creator alert + prospect confirmation) → `sendViaGmail()` using the funnel's `owner_id` → creator's Gmail connection
- If Gmail isn't connected for that creator, fall back to Resend with a clear "via Nevorai on behalf of {creator}" From-name so leads still receive something.
- If Resend key is missing, log warning and return `{ ok:false, reason:"no_resend_key" }` without crashing.

### 2. `supabase/functions/send-gmail-email` — verify it scopes to the right creator

- Confirm the edge function accepts a `creator_id` / `owner_id` so it picks the correct Gmail token (not always the admin's). If it currently uses a single shared Gmail token, that's a bug — leads on Creator A's funnel would be sent from Creator B's Gmail. I will read the function first and patch if needed.

### 3. Lead-submission call sites

- Verify the funnel lead-capture handler posts `{ type: "lead", funnel_id, prospect }` to `/api/public/email/send`. No changes expected, but I'll confirm.

### 4. Receipt / welcome call sites

- Verify Razorpay webhook + signup hook still post `{ type: "receipt" | "welcome", ... }` to the same endpoint. The endpoint will now route them through Resend automatically.

## Out of scope

- I will NOT change the admin Gmail settings UI.
- I will NOT touch Resend domain/DNS config.
- I will NOT change the multi-step funnel gating or any other unrelated code from the previous turns.

## Verification

1. Trigger a fake lead submission → confirm it sends via Gmail (check `send-gmail-email` logs).
2. Trigger a test welcome/receipt payload → confirm it sends via Resend (check `server-function-logs` for `[email] resend send ok`).
3. Confirm no email type silently no-ops.

Ready to implement on approval.