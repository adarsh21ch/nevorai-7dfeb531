
-- 1. App roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 4. Profiles
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  company TEXT,
  team_size TEXT,
  city TEXT,
  instagram_url TEXT,
  whatsapp_number TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_data JSONB,
  kyc_status TEXT DEFAULT 'none',
  kyc_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Subscription plans
CREATE TABLE public.admin_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT UNIQUE NOT NULL, label TEXT NOT NULL, tier TEXT NOT NULL, price_inr INTEGER NOT NULL,
  duration_days INTEGER, billing_type TEXT NOT NULL, features JSONB, funnel_limit INTEGER,
  video_limit INTEGER, video_max_size_mb INTEGER, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.admin_subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.admin_subscription_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_subscription_plans (plan_key, label, tier, price_inr, duration_days, billing_type, funnel_limit, video_limit, video_max_size_mb) VALUES
  ('free', 'Free', 'free', 0, NULL, 'free', 2, 5, 100),
  ('basic_monthly', 'Basic', 'basic', 199, 30, 'recurring', 10, 20, 500),
  ('basic_6months', 'Basic 6 Months', 'basic', 999, 180, 'one_time', 10, 20, 500),
  ('basic_yearly', 'Basic Yearly', 'basic', 1499, 365, 'one_time', 10, 20, 500),
  ('pro_monthly', 'Pro', 'pro', 499, 30, 'recurring', NULL, NULL, 2048),
  ('pro_6months', 'Pro 6 Months', 'pro', 2499, 180, 'one_time', NULL, NULL, 2048),
  ('pro_yearly', 'Pro Yearly', 'pro', 2999, 365, 'one_time', NULL, NULL, 2048);

-- 6. User subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_key TEXT NOT NULL, tier TEXT NOT NULL, status TEXT DEFAULT 'active', billing_type TEXT,
  amount_paid INTEGER DEFAULT 0, started_at TIMESTAMPTZ DEFAULT now(), expires_at TIMESTAMPTZ,
  razorpay_order_id TEXT, razorpay_payment_id TEXT, razorpay_subscription_id TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan_key, tier, status, billing_type) VALUES (NEW.id, 'free', 'free', 'active', 'free');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- 7. Platform settings
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), key TEXT UNIQUE NOT NULL, value TEXT, updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.platform_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.platform_settings (key, value) VALUES ('announcement_text', ''), ('announcement_active', 'false'), ('maintenance_mode', 'false');

-- 8. Video folders
CREATE TABLE public.video_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, color TEXT DEFAULT '#2563EB', position INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.video_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own folders" ON public.video_folders FOR ALL USING (auth.uid() = owner_id);

-- 9. Video assets
CREATE TABLE public.video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL, description TEXT, original_filename TEXT, file_size_bytes BIGINT,
  duration_seconds INTEGER, r2_key TEXT UNIQUE, r2_thumbnail_key TEXT, public_url TEXT, thumbnail_url TEXT,
  folder_id UUID REFERENCES public.video_folders(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'uploading', upload_percent INTEGER DEFAULT 0, error_message TEXT,
  is_shared BOOLEAN DEFAULT false, view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.video_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own videos" ON public.video_assets FOR ALL USING (auth.uid() = owner_id);
CREATE TRIGGER update_video_assets_updated_at BEFORE UPDATE ON public.video_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Video access sharing
CREATE TABLE public.video_asset_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES public.video_assets(id) ON DELETE CASCADE NOT NULL,
  granted_to UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(), UNIQUE(video_id, granted_to)
);
ALTER TABLE public.video_asset_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view access grants" ON public.video_asset_access FOR SELECT USING (auth.uid() = granted_to OR auth.uid() = granted_by);
CREATE POLICY "Users can grant access to own videos" ON public.video_asset_access FOR INSERT WITH CHECK (auth.uid() = granted_by AND EXISTS (SELECT 1 FROM public.video_assets WHERE id = video_id AND owner_id = auth.uid()));
CREATE POLICY "Users can revoke access to own videos" ON public.video_asset_access FOR DELETE USING (EXISTS (SELECT 1 FROM public.video_assets WHERE id = video_id AND owner_id = auth.uid()));

CREATE POLICY "Users can view shared videos" ON public.video_assets FOR SELECT USING (EXISTS (SELECT 1 FROM public.video_asset_access WHERE video_id = video_assets.id AND granted_to = auth.uid()));

-- 11. Funnels
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
  video_asset_id UUID REFERENCES public.video_assets(id) ON DELETE SET NULL, thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false, visibility TEXT DEFAULT 'public', password_hash TEXT,
  intent_type TEXT DEFAULT 'lead', allow_seek BOOLEAN DEFAULT false, allow_speed_change BOOLEAN DEFAULT true,
  video_access_minutes INTEGER, cta_text TEXT DEFAULT 'Get Started', cta_timing_seconds INTEGER DEFAULT 60,
  cta_url TEXT, lock_cta BOOLEAN DEFAULT false, audio_note_url TEXT, audio_note_timing TEXT,
  audio_note_autoplay BOOLEAN DEFAULT false, audio_lock_video BOOLEAN DEFAULT false,
  show_contact_buttons BOOLEAN DEFAULT false, contact_whatsapp TEXT, contact_phone TEXT, contact_instagram TEXT,
  show_contact_after_cta BOOLEAN DEFAULT true, whatsapp_auto_message BOOLEAN DEFAULT false,
  whatsapp_message_template TEXT, is_live_broadcast BOOLEAN DEFAULT false, broadcast_status TEXT,
  broadcast_scheduled_at TIMESTAMPTZ, broadcast_password TEXT, broadcast_replay_enabled BOOLEAN DEFAULT true,
  payment_enabled BOOLEAN DEFAULT false, upi_id TEXT, qr_code_url TEXT, payment_instructions TEXT,
  total_views INTEGER DEFAULT 0, total_leads INTEGER DEFAULT 0, total_payments INTEGER DEFAULT 0,
  total_play_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own funnels" ON public.funnels FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can view published funnels" ON public.funnels FOR SELECT USING (is_published = true AND visibility = 'public');
CREATE TRIGGER update_funnels_updated_at BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Funnel price options
CREATE TABLE public.funnel_price_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL, amount INTEGER NOT NULL, description TEXT, position INTEGER DEFAULT 0
);
ALTER TABLE public.funnel_price_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage price options" ON public.funnel_price_options FOR ALL USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Anyone can view published funnel prices" ON public.funnel_price_options FOR SELECT USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND is_published = true));

-- 13. Lead form config
CREATE TABLE public.funnel_lead_form_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL UNIQUE,
  capture_enabled BOOLEAN DEFAULT true, capture_timing TEXT DEFAULT 'before_video',
  show_name BOOLEAN DEFAULT true, name_required BOOLEAN DEFAULT true,
  show_phone BOOLEAN DEFAULT true, phone_required BOOLEAN DEFAULT true,
  show_email BOOLEAN DEFAULT false, email_required BOOLEAN DEFAULT false,
  show_city BOOLEAN DEFAULT true, city_required BOOLEAN DEFAULT false,
  custom_field_label TEXT, show_custom BOOLEAN DEFAULT false, custom_required BOOLEAN DEFAULT false
);
ALTER TABLE public.funnel_lead_form_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage lead form" ON public.funnel_lead_form_config FOR ALL USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Anyone can view published lead form" ON public.funnel_lead_form_config FOR SELECT USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND is_published = true));

-- 14. Funnel leads
CREATE TABLE public.funnel_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL,
  name TEXT, phone TEXT, email TEXT, city TEXT, custom_value TEXT,
  ip_address TEXT, device_type TEXT, user_agent TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  watch_progress_at_submit INTEGER DEFAULT 0, status TEXT DEFAULT 'new',
  notes TEXT, tagged_at TIMESTAMPTZ, submitted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view leads" ON public.funnel_leads FOR SELECT USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Owners can update leads" ON public.funnel_leads FOR UPDATE USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Owners can delete leads" ON public.funnel_leads FOR DELETE USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Anyone can submit leads" ON public.funnel_leads FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND is_published = true));

-- 15. Funnel payments
CREATE TABLE public.funnel_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  selected_price_option_id UUID REFERENCES public.funnel_price_options(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, payment_type TEXT DEFAULT 'upi_manual',
  screenshot_url TEXT, upi_transaction_id TEXT, status TEXT DEFAULT 'pending',
  verified_by UUID REFERENCES public.profiles(id), verified_at TIMESTAMPTZ,
  rejection_note TEXT, submitted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.funnel_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view payments" ON public.funnel_payments FOR SELECT USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Owners can update payments" ON public.funnel_payments FOR UPDATE USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Anyone can submit payment proof" ON public.funnel_payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND is_published = true));

-- 16. Video analytics
CREATE TABLE public.funnel_video_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL, lead_id UUID REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, progress_percent INTEGER DEFAULT 0, watch_seconds INTEGER DEFAULT 0,
  device_type TEXT, recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.funnel_video_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view analytics" ON public.funnel_video_analytics FOR SELECT USING (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND owner_id = auth.uid()));
CREATE POLICY "Anyone can submit analytics" ON public.funnel_video_analytics FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.funnels WHERE id = funnel_id AND is_published = true));

-- 17. KYC
CREATE TABLE public.user_kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL, pan_number TEXT, aadhar_number TEXT,
  pan_doc_url TEXT, aadhar_front_url TEXT, aadhar_back_url TEXT, selfie_url TEXT,
  bank_account_number TEXT, bank_ifsc TEXT, bank_account_name TEXT, bank_name TEXT,
  status TEXT DEFAULT 'pending', reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ, rejection_reason TEXT, submitted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own KYC" ON public.user_kyc_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can submit own KYC" ON public.user_kyc_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own KYC" ON public.user_kyc_submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage KYC" ON public.user_kyc_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 18. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, data JSONB,
  is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 19. Indexes
CREATE INDEX idx_funnels_owner ON public.funnels(owner_id);
CREATE INDEX idx_funnels_slug ON public.funnels(slug);
CREATE INDEX idx_funnel_leads_funnel ON public.funnel_leads(funnel_id);
CREATE INDEX idx_funnel_leads_status ON public.funnel_leads(status);
CREATE INDEX idx_funnel_payments_funnel ON public.funnel_payments(funnel_id);
CREATE INDEX idx_funnel_payments_status ON public.funnel_payments(status);
CREATE INDEX idx_funnel_analytics_funnel ON public.funnel_video_analytics(funnel_id);
CREATE INDEX idx_video_assets_owner ON public.video_assets(owner_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);
