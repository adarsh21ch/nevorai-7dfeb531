
-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-notes', 'audio-notes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('qr-codes', 'qr-codes', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies: kyc-documents
CREATE POLICY "Users upload own KYC docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own KYC docs" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins delete KYC docs" ON storage.objects FOR DELETE USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies: payment-screenshots
CREATE POLICY "Users upload payment screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own payment screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'payment-screenshots' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

-- Storage policies: audio-notes
CREATE POLICY "Users upload audio notes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-notes' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own audio notes" ON storage.objects FOR SELECT USING (bucket_id = 'audio-notes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

-- Storage policies: qr-codes (public)
CREATE POLICY "Anyone view QR codes" ON storage.objects FOR SELECT USING (bucket_id = 'qr-codes');
CREATE POLICY "Users upload QR codes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'qr-codes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admin can manage all videos
CREATE POLICY "Admins can manage all videos" ON public.video_assets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all video access grants
CREATE POLICY "Admins can manage all video access" ON public.video_asset_access FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can view shared/public videos (for the /video/:id page)
CREATE POLICY "Anyone can view shared videos publicly" ON public.video_assets FOR SELECT USING (is_shared = true);

-- Seed subscription plans
INSERT INTO public.admin_subscription_plans (plan_key, label, tier, billing_type, price_inr, duration_days, funnel_limit, video_limit, video_max_size_mb, features, is_active) VALUES
  ('free', 'Free', 'free', 'free', 0, NULL, 2, 5, 100, '{"watermark": true}', true),
  ('basic_monthly', 'Basic Monthly', 'basic', 'monthly', 499, 30, 10, 50, 500, '{"watermark": false, "custom_domain": false}', true),
  ('basic_6mo', 'Basic 6-Month', 'basic', '6month', 2499, 180, 10, 50, 500, '{"watermark": false, "custom_domain": false}', true),
  ('basic_yearly', 'Basic Yearly', 'basic', 'yearly', 3999, 365, 10, 50, 500, '{"watermark": false, "custom_domain": false}', true),
  ('pro_monthly', 'Pro Monthly', 'pro', 'monthly', 999, 30, -1, -1, 2048, '{"watermark": false, "custom_domain": true, "priority_support": true}', true),
  ('pro_6mo', 'Pro 6-Month', 'pro', '6month', 4999, 180, -1, -1, 2048, '{"watermark": false, "custom_domain": true, "priority_support": true}', true),
  ('pro_yearly', 'Pro Yearly', 'pro', 'yearly', 7999, 365, -1, -1, 2048, '{"watermark": false, "custom_domain": true, "priority_support": true}', true)
ON CONFLICT DO NOTHING;

-- Seed platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('announcement_text', ''),
  ('announcement_active', 'false'),
  ('maintenance_mode', 'false')
ON CONFLICT DO NOTHING;
