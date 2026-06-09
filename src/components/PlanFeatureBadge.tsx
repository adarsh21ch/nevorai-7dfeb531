import { usePlanLimits, type PlanConfig } from "@/hooks/usePlanLimits";
import { getPlanRank } from "@/lib/planRank";
import { cn } from "@/lib/utils";

export type GatedFeature = "landingPages" | "goLive" | "funnelCreation" | "videoUpload" | "whatsappAutomation" | "smartReminders" | "customBranding" | "teamMembers";

const FEATURE_CHECK: Record<GatedFeature, (c: PlanConfig) => boolean> = {
  landingPages: (c) => c.feature_landing_pages !== false && (c.max_landing_pages ?? 0) !== 0,
  goLive: (c) => c.feature_go_live !== false && (c.max_live_sessions ?? 0) !== 0,
  funnelCreation: (c) => c.feature_funnel_creation !== false && (c.max_funnels ?? 0) !== 0,
  videoUpload: (c) => c.feature_video_upload === true,
  whatsappAutomation: (c) => c.feature_whatsapp_automation === true,
  smartReminders: (c) => c.feature_smart_reminders === true,
  customBranding: (c) => c.feature_custom_branding === true,
  teamMembers: (c) => (c.max_team_members ?? 0) !== 0,
};

const PLAN_LABEL: Record<string, string> = {
  basic: "Basic",
  growth: "Growth",
  pro: "Pro",
};

/**
 * Returns the lowest paid plan (by display_order, then static rank) that unlocks the given feature.
 * Returns null if no plan unlocks it, or if the user's current tier already includes it.
 */
export const useRequiredPlanForFeature = (feature: GatedFeature): string | null => {
  const { planConfigs, tier } = usePlanLimits();
  const check = FEATURE_CHECK[feature];
  if (!check) return null;

  const userRank = getPlanRank(tier, planConfigs as any);
  const candidates = (planConfigs as any[])
    .filter((c) => c.plan_name !== "free" && c.is_enabled !== false && check(c))
    .sort((a, b) => getPlanRank(a.plan_name, planConfigs as any) - getPlanRank(b.plan_name, planConfigs as any));

  const cheapest = candidates[0];
  if (!cheapest) return null;
  const requiredRank = getPlanRank(cheapest.plan_name, planConfigs as any);
  if (userRank >= requiredRank) return null;
  return cheapest.plan_name as string;
};

interface Props {
  feature: GatedFeature;
  className?: string;
}

/** Renders a small "Basic"/"Growth"/"Pro" chip when the current user's plan does not unlock the feature. */
export const PlanFeatureBadge = ({ feature, className }: Props) => {
  const required = useRequiredPlanForFeature(feature);
  if (!required) return null;
  const label = PLAN_LABEL[required] || required.charAt(0).toUpperCase() + required.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
        className,
      )}
      title={`Available on ${label} plan and above`}
    >
      {label}
    </span>
  );
};

export default PlanFeatureBadge;
