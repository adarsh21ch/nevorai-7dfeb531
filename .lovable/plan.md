## Goal
Confirm `razorpay-webhook` (deployed Supabase function) correctly verifies HMAC signatures and updates `user_subscriptions` / appends to `payment_audit_logs` — first via a simulated signed event, then via a real Razorpay test-mode checkout in the live preview.

## Phase 1 — Simulated signed webhook (handler logic)

1. Pick a target subscription row to mutate
   - Query `user_subscriptions` for the most recent row belonging to your logged-in user (or insert a throwaway test row in `pending` status with a known fake `razorpay_order_id` like `order_TEST_<timestamp>` if none exists).
   - Capture its `id`, `razorpay_order_id`, and current `status` as the "before" snapshot.

2. Build and send a signed `payment.captured` event
   - Read the `RAZORPAY_WEBHOOK_SECRET` value (server-side only — done via a one-off script, not committed).
   - Construct a payload mirroring Razorpay's real shape:
     ```json
     { "event": "payment.captured",
       "event_id": "evt_test_<uuid>",
       "payload": { "payment": { "entity": {
         "id": "pay_TEST_<ts>",
         "order_id": "<order id from step 1>",
         "amount": 49900,
         "notes": { "user_id": "<your uid>", "plan_key": "starter" }
       }}}}
     ```
   - Compute `x-razorpay-signature` = HMAC-SHA256(rawBody, secret), hex.
   - POST to `https://<project>.supabase.co/functions/v1/razorpay-webhook`.

3. Verify outcomes
   - Response is `200 {"status":"ok"}`.
   - `payment_audit_logs` has a new row with `event_type='payment.captured'`, `idempotency_key='webhook_evt_test_<uuid>'`, `source='webhook'`.
   - `user_subscriptions.status` for the row from step 1 flipped to `active` and `razorpay_payment_id` is set.
   - Re-send the exact same payload → response indicates `"status":"duplicate"` and no second audit-log row is added (idempotency check passes).

4. Negative test — bad signature
   - Send the same body with a wrong signature → expect 200 with `{"error":"Invalid signature"}` and no DB changes.

5. Optional secondary events
   - Repeat the same flow with `subscription.activated` and `subscription.charged` against a row that has a `razorpay_subscription_id`, to confirm the other switch branches.

## Phase 2 — End-to-end test checkout

1. Confirm Razorpay dashboard config
   - Webhook URL = `https://<project>.supabase.co/functions/v1/razorpay-webhook`
   - Secret matches `RAZORPAY_WEBHOOK_SECRET`
   - Active events include at least `payment.captured`, `payment.failed`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`.
   - Razorpay account is in **Test Mode**.

2. Drive the live preview
   - Log in (or have you log in) → open Pricing / Billing → start a checkout for the cheapest plan.
   - Pay with the Razorpay test card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.

3. Verify outcomes
   - Razorpay dashboard → Webhooks shows the delivery as 200.
   - `payment_audit_logs` has a real `payment.captured` (and possibly `subscription.*`) row sourced from `webhook`.
   - The corresponding `user_subscriptions` row is `active` with real `razorpay_payment_id` and `razorpay_order_id`.
   - The UI in Billing reflects the active plan.

## Reporting
After each phase I will produce a short report: request status, the audit-log row(s) inserted, the before/after `user_subscriptions` row, and any mismatches with the handler's expected behavior.

## Technical details
- Verification SQL/queries will use the Supabase tools (psql exec is unavailable in this sandbox).
- The HMAC + POST is a one-off Node script run via `code--exec`; secret is read from the Supabase secrets store at runtime, never written to a project file.
- No code changes are required if both phases pass. If `payment_audit_logs.idempotency_key` lacks a unique constraint or the handler misses the row update, I'll propose a fix in a follow-up plan.
