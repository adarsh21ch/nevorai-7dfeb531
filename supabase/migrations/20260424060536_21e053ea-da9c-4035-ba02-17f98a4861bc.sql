UPDATE public.enterprise_plan_config
SET
  features = '[
    {"text": "Your own dedicated application (separate from nFlow)", "enabled": true},
    {"text": "Your own domain name", "enabled": true},
    {"text": "Hosting & maintenance included", "enabled": true},
    {"text": "One-time setup fee included — FREE", "enabled": true},
    {"text": "Unlimited funnels", "enabled": true},
    {"text": "Unlimited landing pages", "enabled": true},
    {"text": "Unlimited live sessions", "enabled": true},
    {"text": "Unlimited video uploads", "enabled": true},
    {"text": "Unlimited team members", "enabled": true},
    {"text": "Custom features for your network", "enabled": true},
    {"text": "Dedicated onboarding support", "enabled": true},
    {"text": "Direct WhatsApp support line", "enabled": true},
    {"text": "Team admin dashboard", "enabled": true},
    {"text": "Priority feature requests", "enabled": true},
    {"text": "Everything in Pro plan included", "enabled": true}
  ]'::jsonb,
  subheading = 'For networks who want their own dedicated app',
  price_note = 'Custom pricing based on scope',
  setup_fee_note = 'No hidden costs — setup, hosting & maintenance all included',
  show_setup_fee_note = true
WHERE id = 1;