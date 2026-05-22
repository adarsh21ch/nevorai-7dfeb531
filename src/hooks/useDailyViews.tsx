import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePlanLimits } from "./usePlanLimits";

export const useDailyViews = () => {
  const { user } = useAuth();
  const { config } = usePlanLimits();

  const { data: profile } = useQuery({
    queryKey: ["profile-daily-views-override", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("custom_daily_views_limit")
        .eq("id", user.id)
        .maybeSingle();
      return data as { custom_daily_views_limit: number | null } | null;
    },
    enabled: !!user,
  });

  const { data: row } = useQuery({
    queryKey: ["user-daily-views-today", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("user_daily_views")
        .select("total_views, view_date")
        .eq("user_id", user.id)
        .eq("view_date", istDate)
        .maybeSingle();
      return data as { total_views: number; view_date: string } | null;
    },
    enabled: !!user,
    refetchInterval: 120_000,
  });

  const planLimit = (config as any)?.daily_view_limit ?? 20;
  const customLimit = profile?.custom_daily_views_limit;
  const effectiveLimit = customLimit ?? planLimit;

  const used = row?.total_views ?? 0;
  const isUnlimited = effectiveLimit === -1;
  const percent = isUnlimited
    ? 0
    : effectiveLimit > 0
    ? Math.min(100, Math.round((used / effectiveLimit) * 100))
    : 0;

  let status: "ok" | "warning" | "limit" = "ok";
  if (!isUnlimited) {
    if (percent >= 100) status = "limit";
    else if (percent >= 80) status = "warning";
  }

  return {
    used,
    limit: effectiveLimit,
    isUnlimited,
    percent,
    status,
    hasCustomOverride: customLimit != null,
  };
};
