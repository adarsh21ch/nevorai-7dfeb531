## What's actually failing

Supabase error:
```
ERROR: 23514: new row for relation "plan_view_tiers" violates check constraint "plan_view_tiers_plan_name_check"
```

This has nothing to do with the `monthly_views` column from last time. The `plan_view_tiers.plan_name` column has a **CHECK constraint** that hard-codes the allowed values (almost certainly `('free','basic','pro','enterprise')`). Inserting `'growth'` is rejected before the row is even written.

The same kind of CHECK is very likely present on `plan_config.plan_name` and `subscription_plans.tier` / `plan_key`, so the next two INSERTs would fail for the same reason.

## Fix — run this SQL in Supabase (one block)

It drops the old CHECKs, recreates them to include `growth`, then runs the inserts. Idempotent and safe to re-run.

```sql
BEGIN;

-- 1. Widen CHECK constraints to allow 'growth'
ALTER TABLE public.plan_view_tiers
  DROP CONSTRAINT IF EXISTS plan_view_tiers_plan_name_check;
ALTER TABLE public.plan_view_tiers
  ADD  CONSTRAINT plan_view_tiers_plan_name_check
  CHECK (plan_name IN ('free','basic','growth','pro','enterprise'));

ALTER TABLE public.plan_config
  DROP CONSTRAINT IF EXISTS plan_config_plan_name_check;
ALTER TABLE public.plan_config
  ADD  CONSTRAINT plan_config_plan_name_check
  CHECK (plan_name IN ('free','basic','growth','pro','enterprise'));

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_tier_check;
ALTER TABLE public.subscription_plans
  ADD  CONSTRAINT subscription_plans_tier_check
  CHECK (tier IN ('free','basic','growth','pro','enterprise'));

-- 2. plan_config row for Growth
INSERT INTO public.plan_config (
  plan_name, is_enabled, view_limit_mode,
  max_funnels, max_landing_pages, max_live_sessions, max_leads,
  max_storage_mb, max_team_members, max_custom_form_fields, max_leads_export,
  daily_view_limit, monthly_views,
  extra_views_unit_size, extra_views_price_per_unit,
  feature_funnel_creation, feature_speaker_profile, feature_video_topics,
  feature_contact_form, feature_privacy_settings, feature_lead_capture,
  feature_custom_form_fields, feature_video_upload, feature_skip_control,
  feature_youtube_import, feature_video_sharing,
  feature_landing_pages, feature_landing_page_email,
  feature_go_live, feature_whatsapp_automation, feature_smart_reminders,
  feature_analytics, feature_advanced_analytics, feature_prospect_analytics,
  feature_insights, multilevel_funnel_enabled,
  feature_team_analytics, feature_custom_branding, feature_show_branding,
  feature_priority_support,
  yearly_validity_days, plan_badge_text
) VALUES (
  'growth', true, 'daily',
  25, 10, 0, 5000,
  15360, 0, 10, 500,
  60, 1800,
  100, 49,
  true, true, true,
  true, true, true,
  true, true, true,
  true, true,
  true, true,
  false, true, true,
  true, true, false,
  true, true,
  false, true, true,
  false,
  365, 'For Active Builders'
)
ON CONFLICT (plan_name) DO NOTHING;

-- 3. plan_view_tiers base row for Growth (NOTE: monthly_views omitted — auto-generated)
INSERT INTO public.plan_view_tiers (
  plan_name, daily_views,
  monthly_price, yearly_price,
  is_base, is_popular, is_active, display_order
) VALUES (
  'growth', 60, 499, 4970, true, false, true, 0
)
ON CONFLICT DO NOTHING;

-- 4. subscription_plans rows
INSERT INTO public.subscription_plans (plan_key, price_inr, is_active, billing_type, duration_days, tier)
VALUES
  ('growth_monthly', 499,  true, 'monthly', 30,  'growth'),
  ('growth_yearly',  4970, true, 'yearly',  365, 'growth')
ON CONFLICT (plan_key) DO UPDATE
  SET price_inr = EXCLUDED.price_inr, is_active = true, tier = EXCLUDED.tier;

COMMIT;
```

If any of the 3 ALTERs errors with "constraint does not exist" — that's fine, `IF EXISTS` swallows it. If it errors with "constraint already exists with different definition" — share the error and I'll adjust the constraint name.

## After the SQL succeeds

Reply "go" and I'll finish the remaining frontend work that was queued from last turn:
- Growth cards in `PricingFullPage.tsx` + `PricingSection.tsx`
- Admin filters / grant buttons in `AdminPlansPage.tsx`, `AdminSubscriptionsPage.tsx`, `AdminUsersPage.tsx`
- `-1 views/day` → "Unlimited daily views" display fix
- `razorpay-portal/index.ts` PLAN_RANK + allow-list widening (+ redeploy command)
