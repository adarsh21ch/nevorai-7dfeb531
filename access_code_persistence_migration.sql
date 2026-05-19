-- Persist the human-readable access code for funnels, steps, and landing pages
-- so the owner can see the saved code when reopening the editor.
-- access_code_hash remains the source of truth for verification.

ALTER TABLE public.funnels        ADD COLUMN IF NOT EXISTS access_code_plain text;
ALTER TABLE public.funnel_steps   ADD COLUMN IF NOT EXISTS access_code_plain text;
ALTER TABLE public.landing_pages  ADD COLUMN IF NOT EXISTS access_code_plain text;

-- Merge "Information to collect from viewers" into Lead Capture
-- by adding the missing State + WhatsApp toggles to the lead form config.
ALTER TABLE public.funnel_lead_form_config
  ADD COLUMN IF NOT EXISTS show_state         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS state_required     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_whatsapp      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_required  boolean NOT NULL DEFAULT false;
