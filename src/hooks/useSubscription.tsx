import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useSubscription = () => {
  const { user } = useAuth();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const tier = subscription?.tier || "free";

  // useFeatureAccess removed — call `usePlanLimits().features.<key>` instead.

  const { data: planLimits } = useQuery({
    queryKey: ["plan-limits", subscription?.plan_key],
    queryFn: async () => {
      if (!subscription) return null;
      const { data } = await supabase
        .from("admin_subscription_plans")
        .select("*")
        .eq("plan_key", subscription.plan_key)
        .single();
      return data;
    },
    enabled: !!subscription,
  });

  return { subscription, tier, isLoading, planLimits };
};
