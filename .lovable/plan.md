# Fully Dynamic Plan Management

Goal: admin can create / edit / delete plans entirely from the UI. No code edits, no DB CHECK constraints, no hardcoded plan name unions.

## 1. Database migration

Run as a migration (schema changes only):

```sql
-- New metadata columns on plan_config
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS display_name  TEXT,
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 100;

-- Drop hardcoded CHECK constraints on plan_name (and any tier siblings)
ALTER TABLE public.plan_config       DROP CONSTRAINT IF EXISTS plan_config_plan_name_check;
ALTER TABLE public.plan_view_tiers   DROP CONSTRAINT IF EXISTS plan_view_tiers_plan_name_check;
ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_tier_check;

-- Add lightweight format check (lowercase a-z, digits, underscore)
ALTER TABLE public.plan_config
  ADD CONSTRAINT plan_config_plan_name_format
  CHECK (plan_name ~ '^[a-z][a-z0-9_]*$');

-- Backfill display_name / display_order for existing rows
UPDATE public.plan_config SET display_name = INITCAP(plan_name) WHERE display_name IS NULL;
UPDATE public.plan_config SET display_order = CASE plan_name
  WHEN 'free' THEN 10
  WHEN 'basic' THEN 20
  WHEN 'growth' THEN 30
  WHEN 'pro' THEN 40
  ELSE 100 END
WHERE display_order = 100;
```

Backend-only, idempotent. After this, adding a new plan is purely a row insert.

## 2. Type system

- `src/config/planFeatures.ts`: change `export type PlanKey = string`. Remove `PLAN_KEYS_ORDER` / `PLAN_LABELS` (now fetched). Keep `PLAN_FEATURES` (column definitions) untouched — those describe `plan_config` columns, not plan names.
- `src/config/planDisplay.ts`: keep `PLAN_DISPLAY` as a **fallback only** for plans the DB doesn't define metadata for. `planDisplay(key)` first looks up `PLAN_DISPLAY[key]`, otherwise returns a generic default `{ name: titleCase(key), ... }`.
- `src/lib/planRank.ts`: replace static `PLAN_RANK` with a `usePlanRank()` hook that reads `display_order` from `plan_config`. Provide a `getPlanRank(key, configs)` pure helper for non-React code.
- Search-and-replace any remaining `'free' | 'basic' | 'growth' | 'pro'` unions with `string`.

## 3. Data hook

New `src/hooks/usePlans.ts`:

```ts
export function usePlans() {
  return useQuery({
    queryKey: ['plans', 'enabled'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plan_config')
        .select('*')
        .eq('is_enabled', true)
        .order('display_order');
      return data ?? [];
    },
  });
}
```

Plus `useAllPlans()` (admin variant, no `is_enabled` filter).

## 4. Pricing page

`src/pages/PricingFullPage.tsx` + `src/components/landing/PricingSection.tsx`:

- Remove all hardcoded references to `free/basic/growth/pro`.
- Use `usePlans()` + existing `usePlanPricing()` (already keyed by plan name).
- Render `.map(plan => <PricingCard plan={plan} tiers={tiersFor(plan.plan_name)} />)`.
- Comparison table columns also derived from the same list.
- Display fix: `daily_views <= 0 || daily_views == null → "Unlimited views/day"`. Same for `monthly_views`.

## 5. Admin Plans page

`src/pages/AdminPlansPage.tsx`:

- Existing per-plan editors keep working (already iterate `PLAN_FEATURES` against `plan_config`). Just change the source list from hardcoded `PLAN_KEYS_ORDER` to `useAllPlans()`.
- **New top-bar "Create plan" button** → opens `CreatePlanDialog` with fields:
  - `plan_name` (validated `^[a-z][a-z0-9_]*$`, uniqueness checked against existing rows)
  - `display_name`, `plan_badge_text`, `description`, `display_order`
  - Monthly price, yearly price, daily views (for the base tier row)
  - All feature toggles + limit fields default to sensible "off / 0" values; admin can edit immediately after create via the existing editor.
- On submit (single transaction-ish flow via two inserts):
  1. `INSERT INTO plan_config (plan_name, display_name, description, display_order, ...defaults, is_enabled=true)`
  2. `INSERT INTO plan_view_tiers (plan_name, daily_views, monthly_price, yearly_price, is_base=true, is_active=true, display_order=1)`
  3. `INSERT INTO subscription_plans (tier, ...monthly + yearly rows)` — same pattern as growth.
- **Delete plan button** per plan card:
  - Confirms with dialog.
  - Pre-check: `SELECT count(*) FROM subscriptions WHERE plan = $plan AND status IN ('active','trial')`. If > 0 → toast "N active subscriptions reference this plan; cannot delete." Otherwise cascade delete `plan_view_tiers`, `subscription_plans`, then `plan_config` row.
  - Free plan is protected (cannot delete) — checked by `plan_name === 'free'`.

## 6. Edge function / razorpay-portal

Already reads tier/plan from DB; just remove any hardcoded `PLAN_RANK` allow-list and derive ranks from `plan_config.display_order` at request time. Provide the redeploy command in the final message.

## 7. Verification

After applying:

1. Pricing page renders all `is_enabled` rows from `plan_config` in `display_order`.
2. Admin → Plans → "Create plan" → add `starter` → appears on `/pricing` after refetch (≤ a few seconds).
3. Existing Free / Basic / Growth / Pro continue to render identically (display_name backfilled, display_order set 10/20/30/40).
4. Delete `starter` works; deleting `pro` is blocked if any subscription references it.
5. `-1` daily/monthly views render as "Unlimited views/day".

## Out of scope

- No visual redesign of pricing cards.
- No billing / Razorpay code changes beyond removing the static plan allow-list.
- No new hardcoded plan name anywhere in the codebase.
