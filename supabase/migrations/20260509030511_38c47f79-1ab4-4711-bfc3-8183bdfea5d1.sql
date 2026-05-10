UPDATE public.platform_settings SET value='+919329040508' WHERE key='support_whatsapp';
UPDATE public.platform_settings SET value='teamnevorai@gmail.com' WHERE key='support_email';
INSERT INTO public.platform_settings (key, value) VALUES ('support_whatsapp','+919329040508') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
INSERT INTO public.platform_settings (key, value) VALUES ('support_email','teamnevorai@gmail.com') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;