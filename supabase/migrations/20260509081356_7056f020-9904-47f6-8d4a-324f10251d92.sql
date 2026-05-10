-- Update Basic and Pro plan defaults to reflect cleaned-up limits.
-- Removed UI fields (max_videos, max_team_members) remain in DB but are no longer
-- enforced through this admin surface.

UPDATE public.plan_config
SET max_funnels = 5,
    max_storage_mb = 5120,        -- 5 GB
    max_landing_pages = 0,
    max_live_sessions = 0,
    max_leads = 500,
    updated_at = now()
WHERE plan_name = 'basic';

UPDATE public.plan_config
SET max_funnels = -1,             -- unlimited
    max_storage_mb = 20480,       -- 20 GB
    max_landing_pages = -1,       -- unlimited
    max_live_sessions = 1,
    max_leads = -1,               -- unlimited
    updated_at = now()
WHERE plan_name = 'pro';