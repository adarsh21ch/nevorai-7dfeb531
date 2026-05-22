import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// IST date helper (matches useDailyViews convention)
const istDateStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

export const useViewsTrend = () => {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["views-trend-30d", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const from = istDateStr(30);
      const { data: rows } = await (supabase as any)
        .from("user_daily_views")
        .select("view_date, total_views")
        .eq("user_id", user!.id)
        .gte("view_date", from);

      const map = new Map<string, number>();
      for (const r of (rows || []) as Array<{ view_date: string; total_views: number }>) {
        map.set(r.view_date, r.total_views || 0);
      }

      const yesterday = map.get(istDateStr(1)) || 0;

      let last7 = 0;
      for (let i = 1; i <= 7; i++) last7 += map.get(istDateStr(i)) || 0;

      let last30 = 0;
      for (let i = 1; i <= 30; i++) last30 += map.get(istDateStr(i)) || 0;

      return { yesterday, last7, last30 };
    },
  });

  return data ?? { yesterday: 0, last7: 0, last30: 0 };
};
