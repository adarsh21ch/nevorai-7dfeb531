/**
 * Single source of truth for everything the admin plan editor manages.
 *
 * Add a new entry here → it automatically appears as a row in the admin
 * comparison table and is persisted to the matching `plan_config` column.
 *
 * `dbField` is the actual column in `plan_config`. A few entries use a
 * `transform` so the admin sees friendly units (e.g. GB) while we store MB.
 */

export type PlanKey = "free" | "basic" | "pro";

export type PlanFeatureCategory = "Limits" | "Features" | "Pricing";

export interface PlanFeatureBase {
  key: string;
  label: string;
  category: PlanFeatureCategory;
  hint?: string;
  dbField: string;
  /** Hide this row entirely for the named plans (still editable in DB). */
  hideFor?: PlanKey[];
}

export interface NumberFeature extends PlanFeatureBase {
  type: "number";
  step?: number;
  /** Convert UI value → DB value (e.g. GB → MB). */
  toDb?: (uiValue: number | null) => number | null;
  /** Convert DB value → UI value. */
  fromDb?: (dbValue: number | null | undefined) => number | null;
}

export interface BooleanFeature extends PlanFeatureBase {
  type: "boolean";
}

export interface TextFeature extends PlanFeatureBase {
  type: "text";
}

export interface SelectFeature extends PlanFeatureBase {
  type: "select";
  options: { value: string; label: string }[];
}

export type PlanFeature = NumberFeature | BooleanFeature | TextFeature | SelectFeature;

export const PLAN_FEATURES: PlanFeature[] = [
  // ─── LIMITS ────────────────────────────────────────────────
  {
    key: "view_limit_mode",
    label: "★ View Limit Mode",
    type: "select",
    category: "Limits",
    hint: "How funnel views are counted & capped",
    dbField: "view_limit_mode",
    options: [
      { value: "daily", label: "📅 Daily" },
      { value: "monthly", label: "📆 Monthly" },
      { value: "both", label: "📅📆 Both" },
    ],
  },
  { key: "monthly_views", label: "Monthly View Limit", type: "number", category: "Limits", hint: "Used when mode is monthly/both. -1 = unlimited", dbField: "monthly_views" },
  { key: "max_daily_views", label: "Daily View Limit", type: "number", category: "Limits", hint: "Used when mode is daily/both. -1 = unlimited", dbField: "daily_view_limit" },
  { key: "extra_views_unit_size", label: "Extra-Views Unit Size", type: "number", category: "Limits", hint: "Views per top-up purchase", dbField: "extra_views_unit_size" },
  { key: "extra_views_price_per_unit", label: "Extra-Views Price (₹)", type: "number", category: "Limits", hint: "Price per top-up unit", dbField: "extra_views_price_per_unit" },
  { key: "max_funnels", label: "Max Funnels", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_funnels" },
  { key: "max_leads_export", label: "Leads CSV Export / month", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_leads_export" },
  // max_videos removed — storage is now the only video constraint.
  {
    key: "max_storage_gb",
    label: "Max Storage (GB)",
    type: "number",
    category: "Limits",
    hint: "0.5 = 500MB · -1 = unlimited",
    dbField: "max_storage_mb",
    step: 0.1,
    toDb: (gb) => (gb == null ? null : gb === -1 ? -1 : Math.round(gb * 1024)),
    fromDb: (mb) => (mb == null ? null : mb === -1 ? -1 : Math.round((mb / 1024) * 100) / 100),
  },
  { key: "max_landing_pages", label: "Max Landing Pages", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_landing_pages" },
  { key: "max_live_sessions", label: "Max Live Sessions", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_live_sessions" },
  { key: "max_leads", label: "Max Leads Stored", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_leads" },
  { key: "max_team_members", label: "Max Team Members", type: "number", category: "Limits", hint: "-1 = unlimited", dbField: "max_team_members" },
  { key: "max_custom_form_fields", label: "Custom Form Fields per Funnel", type: "number", category: "Limits", hint: "-1 = unlimited · 0 = blocked", dbField: "max_custom_form_fields" },

  // ─── FEATURES ─────────────────────────────────────────────
  { key: "feature_funnel_creation", label: "Funnel Creation", type: "boolean", category: "Features", dbField: "feature_funnel_creation" },
  { key: "feature_speaker_profile", label: "Speaker Profile", type: "boolean", category: "Features", hint: "Show speaker bio/photo section inside funnels", dbField: "feature_speaker_profile" },
  { key: "feature_video_topics", label: "Video Topics", type: "boolean", category: "Features", hint: "Allow adding chapter/topic markers to funnel videos", dbField: "feature_video_topics" },
  { key: "feature_contact_form", label: "Contact Form", type: "boolean", category: "Features", hint: "Show contact info section in funnels", dbField: "feature_contact_form" },
  { key: "feature_privacy_settings", label: "Privacy & Access Codes", type: "boolean", category: "Features", hint: "Allow private funnels with access codes", dbField: "feature_privacy_settings" },
  { key: "feature_lead_capture", label: "Lead Capture", type: "boolean", category: "Features", dbField: "feature_lead_capture" },
  { key: "feature_custom_form_fields", label: "Custom Form Fields", type: "boolean", category: "Features", hint: "Let users add custom fields to lead capture forms", dbField: "feature_custom_form_fields" },
  { key: "feature_video_upload", label: "Video Upload", type: "boolean", category: "Features", dbField: "feature_video_upload" },
  { key: "feature_youtube_import", label: "YouTube Video Import", type: "boolean", category: "Features", dbField: "feature_youtube_import" },
  { key: "feature_video_sharing", label: "Video Sharing", type: "boolean", category: "Features", dbField: "feature_video_sharing" },
  { key: "feature_landing_pages", label: "Landing Pages", type: "boolean", category: "Features", dbField: "feature_landing_pages" },
  { key: "feature_landing_page_email", label: "Landing Page Confirmation Email", type: "boolean", category: "Features", hint: "Send branded confirmation email to prospects after they register on a landing page", dbField: "feature_landing_page_email" },
  { key: "feature_go_live", label: "Live Broadcast", type: "boolean", category: "Features", dbField: "feature_go_live" },
  { key: "feature_whatsapp_automation", label: "WhatsApp Auto-Message", type: "boolean", category: "Features", dbField: "feature_whatsapp_automation" },
  { key: "feature_smart_reminders", label: "Smart Follow-up Reminders", type: "boolean", category: "Features", dbField: "feature_smart_reminders" },
  { key: "feature_analytics", label: "Analytics Dashboard", type: "boolean", category: "Features", dbField: "feature_analytics" },
  { key: "feature_advanced_analytics", label: "Advanced Analytics", type: "boolean", category: "Features", dbField: "feature_advanced_analytics" },
  { key: "feature_prospect_analytics", label: "Per-Prospect Watch Analytics", type: "boolean", category: "Features", dbField: "feature_prospect_analytics" },
  { key: "feature_insights", label: "Insights Dashboard", type: "boolean", category: "Features", dbField: "feature_insights" },
  { key: "multilevel_funnel_enabled", label: "Multi-Step Funnels", type: "boolean", category: "Features", dbField: "multilevel_funnel_enabled" },
  { key: "feature_team_analytics", label: "Team Dashboard", type: "boolean", category: "Features", dbField: "feature_team_analytics" },
  { key: "feature_custom_branding", label: "Custom Branding", type: "boolean", category: "Features", dbField: "feature_custom_branding" },
  { key: "feature_show_branding", label: "Show Nevorai Watermark", type: "boolean", category: "Features", hint: "If on, public funnel/landing/video pages show 'Made with Nevorai' badge", dbField: "feature_show_branding" },
  { key: "feature_priority_support", label: "Priority Support", type: "boolean", category: "Features", dbField: "feature_priority_support" },

  // ─── PRICING ───────────────────────────────────────────────
  // Monthly/Yearly prices now live in plan_view_tiers (managed via ViewTiersManager).
  { key: "yearly_validity_days", label: "Yearly Validity (days)", type: "number", category: "Pricing", dbField: "yearly_validity_days", hideFor: ["free"] },
  { key: "plan_badge_text", label: "Badge Text", type: "text", category: "Pricing", hint: "Shown on landing page", dbField: "plan_badge_text", hideFor: ["free"] },
];

export const PLAN_KEYS_ORDER: PlanKey[] = ["free", "basic", "pro"];

// Customer-facing labels. (DB plan_name stays as 'basic' — never rename the key.)
export const PLAN_LABELS: Record<PlanKey, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};
