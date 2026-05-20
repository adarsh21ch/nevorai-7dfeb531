import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePlan } from "./usePlan";
import { useResourceCount } from "./useResourceCount";

export interface PlanConfig {
  plan_name: string;
  yearly_validity_days: number;
  max_funnels: number;
  max_landing_pages: number;
  max_live_sessions: number;
  max_team_members: number;
  // max_videos REMOVED — storage is now the only constraint on uploads.
  max_storage_mb: number;
  multilevel_funnel_enabled: boolean;
  is_enabled?: boolean;
  feature_lead_capture?: boolean;
  feature_analytics?: boolean;
  feature_whatsapp_automation?: boolean;
  feature_video_sharing?: boolean;
  feature_priority_support?: boolean;
  feature_advanced_analytics?: boolean;
  feature_go_live?: boolean;
  feature_landing_pages?: boolean;
  feature_landing_page_email?: boolean;
  feature_team_analytics?: boolean;
  feature_video_upload?: boolean;
  feature_insights?: boolean;
  feature_funnel_creation?: boolean;
  feature_speaker_profile?: boolean;
  feature_video_topics?: boolean;
  feature_contact_form?: boolean;
  feature_privacy_settings?: boolean;
  feature_youtube_import?: boolean;
  feature_smart_reminders?: boolean;
  feature_custom_branding?: boolean;
  feature_prospect_analytics?: boolean;
  daily_view_limit?: number;
  max_leads?: number;
  plan_badge_text?: string | null;
  feature_custom_form_fields?: boolean;
  max_custom_form_fields?: number;
}

const FREE_FALLBACK: PlanConfig = {
  plan_name: "free",
  yearly_validity_days: 0,
  max_funnels: 0,
  max_landing_pages: 0,
  max_live_sessions: 0,
  max_team_members: 0,
  max_storage_mb: 0,
  multilevel_funnel_enabled: false,
};

export const usePlanLimits = () => {
  const { user } = useAuth();
  const { plan } = usePlan();
  const counts = useResourceCount();

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["plan-configs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("plan_config").select("*");
      return (data || []) as PlanConfig[];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: teamCount = 0 } = useQuery({
    queryKey: ["team-member-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await (supabase as any)
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .in("status", ["pending", "active"]);
      return count || 0;
    },
    enabled: !!user && plan.tier === "pro",
  });

  const tier = plan.tier;
  const lookupTier = tier === "trial" ? "pro" : tier;
  const config = planConfigs.find(c => c.plan_name === lookupTier) || FREE_FALLBACK;

  const isFree = tier === "free" || (!plan.isPaid && tier !== "trial");

  const canCreateFunnel = config.feature_funnel_creation !== false && (config.max_funnels === -1 || counts.funnels < config.max_funnels);
  const canCreateLandingPage = config.feature_landing_pages !== false && (config.max_landing_pages === -1 || counts.landing_pages < config.max_landing_pages);
  const canCreateLive = config.feature_go_live !== false && (config.max_live_sessions === -1 || counts.live_sessions < config.max_live_sessions);
  const canUseMultilevel = config.multilevel_funnel_enabled;
  const canAddTeamMember = tier === "pro" && (config.max_team_members === -1 || teamCount < config.max_team_members);
  // Storage is the only quota — see useStorageUsage for the enforced check.
  const canUploadVideo = config.feature_video_upload === true;

  const isFunnelLimitReached = config.max_funnels !== -1 && counts.funnels >= config.max_funnels;
  const isLandingPageLimitReached = config.max_landing_pages !== -1 && counts.landing_pages >= config.max_landing_pages;
  const isLiveLimitReached = config.max_live_sessions !== -1 && counts.live_sessions >= config.max_live_sessions;
  const isTeamLimitReached = tier === "pro" && config.max_team_members !== -1 && teamCount >= config.max_team_members;
  const isVideoLimitReached = false; // Deprecated — storage limit is enforced by useStorageUsage.

  const features = {
    leadCapture: config.feature_lead_capture !== false,
    analytics: config.feature_analytics !== false,
    whatsappAutomation: config.feature_whatsapp_automation === true,
    videoSharing: config.feature_video_sharing === true,
    prioritySupport: config.feature_priority_support === true,
    advancedAnalytics: config.feature_advanced_analytics === true,
    multilevelFunnels: config.multilevel_funnel_enabled,
    teamMembers: tier === "pro" && config.max_team_members !== 0,
    teamAnalytics: config.feature_team_analytics === true,
    goLive: config.feature_go_live !== false,
    landingPages: config.feature_landing_pages !== false,
    landingPageEmail: config.feature_landing_page_email === true,
    videoUpload: config.feature_video_upload === true,
    insights: config.feature_insights === true,
    funnelCreation: config.feature_funnel_creation !== false,
    youtubeImport: config.feature_youtube_import === true,
    smartReminders: config.feature_smart_reminders === true,
    customBranding: config.feature_custom_branding === true,
    prospectAnalytics: config.feature_prospect_analytics === true,
    speakerProfile: config.feature_speaker_profile === true,
    videoTopics: config.feature_video_topics !== false,
    contactForm: config.feature_contact_form !== false,
    privacySettings: config.feature_privacy_settings !== false,
    customFormFields: config.feature_custom_form_fields === true,
  };

  return {
    tier, isFree, config, counts, teamCount,
    canCreateFunnel, canCreateLandingPage, canCreateLive, canUseMultilevel,
    canAddTeamMember, canUploadVideo,
    isFunnelLimitReached, isLandingPageLimitReached, isLiveLimitReached,
    isTeamLimitReached, isVideoLimitReached,
    planConfigs, features,
  };
};
