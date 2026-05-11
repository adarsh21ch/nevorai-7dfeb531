import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve whether the owner of a public asset (funnel / landing page / video)
 * is on a plan where the nFlow branding watermark must be shown.
 *
 * Logic:
 * - Look up the owner's active subscription tier via user_subscriptions.
 * - Read plan_config.feature_show_branding for that plan.
 * - Free / no subscription → defaults to showing branding.
 */
export function useOwnerBranding(ownerId?: string | null) {
  return useQuery({
    queryKey: ["owner-branding", ownerId],
    enabled: !!ownerId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!ownerId) return { show: true };

      const { data: sub } = await (supabase as any)
        .from("user_subscriptions")
        .select("plan_key, tier, status")
        .eq("user_id", ownerId)
        .in("status", ["active", "payment_failed", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const planName = (sub?.tier || sub?.plan_key || "free")
        .toString()
        .replace(/_(monthly|yearly)$/, "");

      const { data: cfg } = await (supabase as any)
        .from("plan_config")
        .select("feature_show_branding")
        .eq("plan_name", planName)
        .maybeSingle();

      // Default: show branding when unknown (safer for Free)
      const show = cfg?.feature_show_branding ?? true;
      return { show, planName };
    },
  });
}
