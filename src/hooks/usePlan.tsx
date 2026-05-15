import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTrialStatus } from "./useTrialStatus";
import { useCallback } from "react";

export interface PlanLimits {
  funnel_limit: number | null;
  video_limit: number | null;
  video_max_size_mb: number | null;
  landing_page_limit: number | null;
  live_session_limit: number | null;
  multi_step_funnel_enabled: boolean;
}

export interface PlanInfo {
  isActive: boolean;
  isPaid: boolean;
  tier: string;
  planKey: string;
  status: string;
  expiresAt: string | null;
  startedAt: string | null;
  billingType: string | null;
  amountPaid: number | null;
  razorpayPaymentId: string | null;
  daysLeft: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  limits: PlanLimits;
}

const FREE_LIMITS_FALLBACK: PlanLimits = {
  funnel_limit: 1,
  video_limit: 3,
  video_max_size_mb: 100,
  landing_page_limit: 1,
  live_session_limit: 0,
  multi_step_funnel_enabled: false,
};

const PREMIUM_FEATURES = [
  "video_upload","video_sharing","live_broadcast","advanced_analytics",
  "premium_templates","premium_automation","whatsapp_auto",
  "unlimited_funnels","unlimited_videos",
];

export const usePlan = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const trial = useTrialStatus();
  const trialActive = trial.subscriptionStatus === "trial" && !trial.isTrialExpired && trial.isTrialEnabled;

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["user-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "payment_failed", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const activePlanKey = trialActive ? "pro_monthly" : (subscription?.plan_key || "free");
  const { data: planConfig } = useQuery({
    queryKey: ["plan-config", activePlanKey],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("admin_subscription_plans")
        .select("*")
        .eq("plan_key", activePlanKey)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Free-tier limits live in plan_config (admin-driven). Read once and fall
  // back to constants if the row is missing so usePlan never returns null.
  const { data: freePlanCfg } = useQuery({
    queryKey: ["plan-config-free"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plan_config")
        .select("max_funnels, max_videos, max_storage_mb, max_landing_pages, max_live_sessions, multilevel_funnel_enabled")
        .eq("plan_name", "free")
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const freeLimits: PlanLimits = freePlanCfg ? {
    funnel_limit: freePlanCfg.max_funnels ?? FREE_LIMITS_FALLBACK.funnel_limit,
    video_limit: freePlanCfg.max_videos ?? FREE_LIMITS_FALLBACK.video_limit,
    video_max_size_mb: freePlanCfg.max_storage_mb ?? FREE_LIMITS_FALLBACK.video_max_size_mb,
    landing_page_limit: freePlanCfg.max_landing_pages ?? FREE_LIMITS_FALLBACK.landing_page_limit,
    live_session_limit: freePlanCfg.max_live_sessions ?? FREE_LIMITS_FALLBACK.live_session_limit,
    multi_step_funnel_enabled: !!freePlanCfg.multilevel_funnel_enabled,
  } : FREE_LIMITS_FALLBACK;

  const now = new Date();
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000) : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;

  const isActive = subscription?.status === "active" && !isExpired;
  const isPaid = isActive && subscription?.tier && subscription.tier !== "free";
  const tier = trialActive ? "trial" : (isActive ? (subscription?.tier || "free") : "free");

  const limits: PlanLimits = (isPaid || trialActive) && planConfig ? {
    funnel_limit: planConfig.funnel_limit,
    video_limit: planConfig.video_limit,
    video_max_size_mb: planConfig.video_max_size_mb,
    landing_page_limit: (planConfig as any).landing_page_limit ?? null,
    live_session_limit: (planConfig as any).live_session_limit ?? null,
    multi_step_funnel_enabled: (planConfig as any).multi_step_funnel_enabled ?? false,
  } : freeLimits;

  const plan: PlanInfo = {
    isActive,
    isPaid,
    tier,
    planKey: subscription?.plan_key || "free",
    status: isExpired ? "expired" : (subscription?.status || "active"),
    expiresAt: subscription?.expires_at || null,
    startedAt: subscription?.started_at || null,
    billingType: subscription?.billing_type || null,
    amountPaid: subscription?.amount_paid || null,
    razorpayPaymentId: subscription?.razorpay_payment_id || null,
    daysLeft,
    isExpired,
    isExpiringSoon,
    limits,
  };

  const canAccess = useCallback((feature: string): boolean => {
    if (tier === "pro" || tier === "trial") return true;
    if (tier === "basic") {
      return !["live_broadcast", "video_sharing", "premium_templates", "premium_automation"].includes(feature);
    }
    return !PREMIUM_FEATURES.includes(feature);
  }, [tier]);

  const canCreate = useCallback((resource: "flow" | "landing_page" | "live_session", currentCount: number): boolean => {
    const limitMap = {
      funnel: limits.funnel_limit,
      landing_page: limits.landing_page_limit,
      live_session: limits.live_session_limit,
    };
    const limit = limitMap[resource];
    if (limit === null || limit === undefined) return true;
    return currentCount < limit;
  }, [limits]);

  const canUseMultiStep = limits.multi_step_funnel_enabled;

  const refreshPlan = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["user-plan"] });
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    queryClient.invalidateQueries({ queryKey: ["plan-config"] });
    queryClient.invalidateQueries({ queryKey: ["trial-status"] });
    queryClient.invalidateQueries({ queryKey: ["monthly-views"] });
    queryClient.invalidateQueries({ queryKey: ["user-daily-views-today"] });
    queryClient.invalidateQueries({ queryKey: ["profile-daily-views-override"] });
    queryClient.invalidateQueries({ queryKey: ["profile-unlimited"] });
  }, [queryClient]);

  return { plan, canAccess, canCreate, canUseMultiStep, isLoading, refreshPlan };
};
