-- Enforce one account per verified WhatsApp number.
-- whatsapp_number + whatsapp_verified columns are added by an earlier migration.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_whatsapp_number_verified_idx
  ON public.profiles(whatsapp_number)
  WHERE whatsapp_verified = true;
