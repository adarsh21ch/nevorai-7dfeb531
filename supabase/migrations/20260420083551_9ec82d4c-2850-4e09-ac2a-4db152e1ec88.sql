
-- Add USD pricing columns (admin-editable)
ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS usd_price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_price_yearly  numeric(10,2) NOT NULL DEFAULT 0;

-- Seed initial USD prices (idempotent)
UPDATE public.plan_config SET usd_price_monthly = 9,  usd_price_yearly = 89  WHERE plan_name = 'basic';
UPDATE public.plan_config SET usd_price_monthly = 39, usd_price_yearly = 389 WHERE plan_name = 'pro';
UPDATE public.plan_config SET usd_price_monthly = 0,  usd_price_yearly = 0   WHERE plan_name = 'free';

-- Stripe-related columns on user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_sub
  ON public.user_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions(user_id, status);
