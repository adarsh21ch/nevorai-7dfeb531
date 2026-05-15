# Bug: Razorpay popup shows ₹449/₹499 instead of the ₹149 Basic plan

## Root cause

`supabase/functions/razorpay-portal/index.ts` (action `create_order`) computes the charge from **two different tables**:

1. `admin_subscription_plans.price_inr` — initial value of `authoritativeAmount`.
2. `plan_view_tiers` (row where `is_base = true` and `is_active = true`) — overrides #1 only if a base row exists.

```ts
let authoritativeAmount = Number(planData.price_inr);   // e.g. 499 (stale)
...
if (baseRow) authoritativeAmount = pickTierPrice(baseRow, ...); // 149 — only if found
```

The pricing UI (`PricingFullPage.tsx` → `withBasePrice`) shows **only** the `plan_view_tiers` base price (₹149 in the admin screenshot). The server falls back to `admin_subscription_plans.price_inr` whenever:

- the base tier row is missing,
- `is_base` is not flagged on any row,
- `is_active = false` on the base row,
- the `basic`/`pro` branch in the server doesn't run for some reason (e.g. legacy `plan_key` like `basic` without `_monthly`).

Result: user sees ₹149 in the UI, Razorpay charges ₹449/₹499 from the legacy `admin_subscription_plans` row.

## Fix

### 1. Server: single source of truth, no silent fallback
In `supabase/functions/razorpay-portal/index.ts`, action `create_order`:
- Resolve price **exclusively** from `plan_view_tiers` (the table the admin panel edits and the UI displays).
- If no active base tier row exists for the requested plan, return `400 { error: "Pricing not configured for this plan" }` instead of falling back to `admin_subscription_plans.price_inr`.
- Keep `admin_subscription_plans` only as the on/off + metadata table (`is_active`, `billing_type`, `duration_days`).
- Same change for `create_tier_upgrade_order` if it has the same fallback pattern.

### 2. Server: price-parity guard (defense in depth)
- Accept an optional `display_price` from the client (the price the user actually saw).
- If `Math.round(display_price) !== Math.round(authoritativeAmount)` AND it isn't a known proration case, refuse with `409 { error: "Displayed price changed; please refresh" }`.
- Log mismatches to `payment_audit_logs` with `event_type = "price_mismatch_blocked"` so we can see how often this happens.

### 3. Client: pass `display_price`
- `PricingFullPage.tsx` (line ~239) and `PricingSection.tsx` (line ~211): include `display_price: getPrice(config)` in the `create_order` body.
- No UI change.

### 4. One-time data cleanup (migration)
Sync `admin_subscription_plans.price_inr` with the active base tier from `plan_view_tiers` so any other code path reading `price_inr` stops returning stale values:

```sql
UPDATE admin_subscription_plans p
SET price_inr = t.monthly_price
FROM plan_view_tiers t
WHERE t.plan_name = split_part(p.plan_key, '_', 1)
  AND t.is_base = true
  AND t.is_active = true
  AND p.billing_type = 'monthly';

UPDATE admin_subscription_plans p
SET price_inr = t.yearly_price
FROM plan_view_tiers t
WHERE t.plan_name = split_part(p.plan_key, '_', 1)
  AND t.is_base = true
  AND t.is_active = true
  AND p.billing_type = 'yearly';
```

### 5. Verify
- Build passes (`npm run build`).
- Manual test: click Basic ₹149 → Razorpay popup must show ₹149. Click Pro → must show the Pro base tier price from admin. Upgrade Basic→Pro mid-cycle → must show prorated amount.
- Check `payment_audit_logs` for any `price_mismatch_blocked` entries after deploy.

## Out of scope
- Admin UI redesign.
- Refactoring the proration math (already correct, just downstream of `authoritativeAmount`).
- Edit-button / loader work from previous turns.
