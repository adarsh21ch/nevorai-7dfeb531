# Remove `subscription_plans` references

The bare `subscription_plans` table does not exist in this project. Only `plan_config` and `plan_view_tiers` are the plan source of truth. (Note: `admin_subscription_plans` is a different, in-use table — leaving it alone.)

## Changes

1. **`src/components/admin/CreatePlanDialog.tsx`** — drop the third insert block that writes monthly + yearly rows into `subscription_plans` (lines ~141–166). Creating a plan will only insert into `plan_config` + `plan_view_tiers`.

2. **`src/pages/AdminPlansPage.tsx`** (line 298) — remove `await wipe("subscription_plans", "tier");` from the delete flow. Delete order becomes: `plan_view_tiers` → `plan_config`.

3. **`dynamic_plans_migration.sql`** (line 15) — remove the `ALTER TABLE public.subscription_plans DROP CONSTRAINT ...` line, since the table doesn't exist. (Migration already ran successfully; this is for cleanliness if re-run.)

## Out of scope

- `admin_subscription_plans` (different table, actively used by billing/razorpay/plan hooks) — untouched.
