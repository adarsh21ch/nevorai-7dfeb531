-- Run this in the Supabase SQL editor.
-- Adds missing lead-form columns so public funnel pages render every field
-- the creator enables (state, WhatsApp, custom fields), and so lead submits
-- can persist those values.

ALTER TABLE public.funnel_lead_form_config
  ADD COLUMN IF NOT EXISTS show_state         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS state_required     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_whatsapp      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_required  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_fields      jsonb   NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.funnel_leads
  ADD COLUMN IF NOT EXISTS state               text,
  ADD COLUMN IF NOT EXISTS whatsapp            text,
  ADD COLUMN IF NOT EXISTS custom_field_values jsonb NOT NULL DEFAULT '{}'::jsonb;
