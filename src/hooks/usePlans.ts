import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanConfigRow {
  plan_name: string;
  display_name: string | null;
  description: string | null;
  display_order: number | null;
  is_enabled: boolean;
  plan_badge_text: string | null;
  [field: string]: any;
}

const orderRows = (rows: PlanConfigRow[]) =>
  [...rows].sort(
    (a, b) => (a.display_order ?? 100) - (b.display_order ?? 100) || a.plan_name.localeCompare(b.plan_name),
  );

/** All plans the public site / billing should consider (is_enabled=true). */
export function usePlans() {
  return useQuery({
    queryKey: ["plans", "enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_config")
        .select("*")
        .eq("is_enabled", true);
      if (error) throw error;
      return orderRows((data || []) as unknown as PlanConfigRow[]);
    },
    staleTime: 30_000,
  });
}

/** All plans (admin view — includes disabled). */
export function useAllPlans() {
  return useQuery({
    queryKey: ["plans", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_config").select("*");
      if (error) throw error;
      return orderRows((data || []) as unknown as PlanConfigRow[]);
    },
    staleTime: 15_000,
  });
}

/** Human display name with safe fallback. */
export const planLabel = (row?: Pick<PlanConfigRow, "plan_name" | "display_name"> | null): string => {
  if (!row) return "—";
  if (row.display_name && row.display_name.trim()) return row.display_name;
  return row.plan_name.charAt(0).toUpperCase() + row.plan_name.slice(1);
};
