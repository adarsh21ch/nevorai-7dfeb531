## Scope

Add a new plan key `growth` ordered between `basic` and `pro`. It must flow through the **same** structure as Free/Basic/Pro — admin editable via `plan_config`, priced via `plan_view_tiers`, paid via `subscription_plans` + `razorpay-portal` edge function. Enterprise stays unchanged (still contact-sales).

After this change the tier rank is: `free (0) < basic (1) < growth (2) < pro (3)`.

## 1. Supabase SQL (you copy-paste this)

Run as one transaction in the Supabase SQL editor. Idempotent (uses `ON CONFLICT`).

```sql
-- 1a. plan_config row for Growth (defaults — admin can edit later)
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

-- 1b. plan_view_tiers base row for Growth (₹499/mo, yearly = 12*499*0.83 ≈ 4970)
INSERT INTO public.plan_view_tiers (
  plan_name, daily_views, monthly_views,
  monthly_price, yearly_price,
  is_base, is_popular, is_active, display_order
) VALUES (
  'growth', 60, 1800, 499, 4970, true, false, true, 0
)
ON CONFLICT DO NOTHING;

-- 1c. subscription_plans rows (this is what razorpay-portal looks up by plan_key)
INSERT INTO public.subscription_plans (plan_key, price_inr, is_active, billing_type, duration_days, tier)
VALUES
  ('growth_monthly', 499,  true, 'monthly', 30,  'growth'),
  ('growth_yearly',  4970, true, 'yearly',  365, 'growth')
ON CONFLICT (plan_key) DO UPDATE
  SET price_inr = EXCLUDED.price_inr, is_active = true, tier = EXCLUDED.tier;
```

If `get_plan_pricing` RPC has a hardcoded `basic`/`pro` whitelist, also patch it — share its current definition and I'll provide the diff.

## 2. Frontend changes (config-driven, no new hardcoded branches)

### Core config (one source of truth)
- `src/config/planFeatures.ts`
  - `PlanKey` → add `"growth"`
  - `PLAN_KEYS_ORDER` → `["free", "basic", "growth", "pro"]`
  - `PLAN_LABELS.growth = "Growth"`
- `src/config/planDisplay.ts` — add `growth` entry (indigo→emerald gradient, badge styling)

### Tier ranking helper (new, replaces scattered string compares)
- New `src/lib/planRank.ts`:
  ```ts
  export const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, growth: 2, pro: 3, trial: 3 };
  export const isAtLeast = (tier: string|undefined|null, min: string) =>
    (PLAN_RANK[tier ?? "free"] ?? 0) >= (PLAN_RANK[min] ?? 0);
  ```
  Use this in places that currently do `tier === "pro" || tier === "trial"` etc.

### Pages (extend existing patterns — no hardcoded Growth-only UI)
- `src/pages/PricingFullPage.tsx`
  - Compute `growthConfig` the same way as `basicConfig`/`proConfig`
  - Add `growthEnabled`, `growthCard`, `effectiveGrowth`
  - Insert into `cards[]` between basic and pro
  - Extend `desktopGridCols` to handle 1/2/3/4 cards
  - Extend `buildComparisonRows` with a `growth` column
  - Extend `handlePayment` allow-list (`target !== "basic" && target !== "pro" && target !== "growth"`)
  - Upgrade-diff math: compute against the *current* tier using `PLAN_RANK`
- `src/components/landing/PricingSection.tsx` — same pattern (3 paid cards now)
- `src/pages/BillingPage.tsx`
  - `.in("plan_name", ["basic", "growth", "pro"])`
  - Render Growth tier card alongside Basic/Pro using existing tier-card template
  - Upgrade/downgrade button labels driven by `PLAN_RANK`
- `src/pages/AdminPlansPage.tsx` & `src/pages/AdminSubscriptionsPage.tsx`
  - Filter type: `"all" | "free" | "basic" | "growth" | "pro"`
  - Render Growth admin card (reuses `renderPlanCard`)
  - Pass `"growth"` into `ViewTiersManager`
  - Manual-grant buttons include Growth
- `src/pages/AdminUsersPage.tsx` — add `growth` to filter + counts
- `src/components/admin/ViewTiersManager.tsx` — widen prop type to `"basic" | "growth" | "pro"`
- `src/components/billing/ViewCapacityCard.tsx` — Growth treated like Basic (paid tier)
- `src/hooks/useStorageUsage.ts` — `if (tier === "growth") return "growth"`
- `src/hooks/usePlanLimits.tsx` & `src/hooks/usePlan.tsx` — replace direct `=== "pro"` checks with `isAtLeast(tier, "pro")` where appropriate (team-member features stay Pro-only; everything else gets the new rank-based check)
- `src/pages/AdminSubscriptionsPage.tsx` plan-key map: `growth_monthly` for Growth grants
- `src/components/admin/PlanEditorTable.tsx` — already iterates `PLAN_KEYS_ORDER`, so it auto-picks up Growth (verify badge color falls through cleanly)

### Bug fix in the same data flow
In `PricingFullPage.tsx` / `PricingSection.tsx` view-limit display:
- Replace any `"-1 views/day"` or `"starts at -1/day"` render with `"Unlimited daily views"` when value is `-1`, or fall back to `"Daily view limit included"` if the number is missing.

## 3. Razorpay edge function (`supabase/functions/razorpay-portal/index.ts`)

Three surgical changes — same structure, just widened:
- `PLAN_RANK` → `{ free: 0, basic: 1, growth: 2, pro: 3 }`
- Base-tier lookup branch `baseTier === "basic" || baseTier === "pro"` → `["basic","growth","pro"].includes(baseTier)`
- Proration guard `currentBasePlan === "basic" || currentBasePlan === "pro"` → `["basic","growth","pro"].includes(currentBasePlan)`
  - Proration math stays the same — it already compares `PLAN_RANK[from] < PLAN_RANK[to]`, so Basic→Growth, Growth→Pro, and Basic→Pro all just work.
- `cancel` handler `basePlan !== "basic" && basePlan !== "pro"` → include `"growth"`

You'll need to redeploy the function: `supabase functions deploy razorpay-portal`.

## 4. Verification (I'll run after implementation)

1. `tsc --noEmit` clean
2. Public `/pricing` shows 4 cards (Free · Basic · Growth · Pro) on desktop; mobile carousel cycles 4 dots
3. Admin → Plans shows Growth card with all the same toggles as Basic/Pro and a working View Tiers manager
4. Admin → Subscriptions grant buttons: Basic / Growth / Pro
5. Billing page: Basic user sees "Upgrade to Growth (+price diff)" and "Upgrade to Pro (+price diff)"; Growth user sees "Upgrade to Pro" only
6. `-1` daily view limit anywhere in the pricing flow now reads as "Unlimited daily views"

## Out of scope (untouched)

- Free / Basic / Pro / Enterprise behavior, copy, colors
- Existing card design — only the grid container is widened to fit 4 cards
- Trial logic (trial still grants Pro-equivalent access)
- Any unrelated module

## What I need from you to start

Just confirm "go" and I'll: (a) write all the code, (b) hand back the SQL block above for you to paste into Supabase, (c) hand back the redeploy command for the razorpay-portal function. If you also want me to attempt the edge function redeploy from here, say so — otherwise I'll only edit the file and you deploy it.
