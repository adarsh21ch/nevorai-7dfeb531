-- Per-channel contact toggles for funnels (WhatsApp / Call / Instagram)
-- Paste into Supabase SQL editor.

ALTER TABLE public.funnels
  ADD COLUMN IF NOT EXISTS contact_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_phone_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_instagram_enabled BOOLEAN NOT NULL DEFAULT false;

-- Backfill: if an existing funnel already has a value saved for a channel,
-- treat it as enabled so behaviour doesn't silently change.
UPDATE public.funnels SET contact_whatsapp_enabled  = true WHERE contact_whatsapp  IS NOT NULL AND contact_whatsapp  <> '';
UPDATE public.funnels SET contact_phone_enabled     = true WHERE contact_phone     IS NOT NULL AND contact_phone     <> '';
UPDATE public.funnels SET contact_instagram_enabled = true WHERE contact_instagram IS NOT NULL AND contact_instagram <> '';

-- "Show only after CTA" should default OFF for new funnels.
ALTER TABLE public.funnels ALTER COLUMN show_contact_after_cta SET DEFAULT false;
