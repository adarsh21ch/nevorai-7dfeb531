import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ViewTier {
  id: string;
  daily_views: number;
  monthly_views: number;
  monthly_price: number;
  yearly_price: number;
  is_base: boolean;
  is_popular: boolean;
  display_order: number;
}

export interface PlanPricing {
  base: { daily_views: number; monthly_price: number; yearly_price: number } | null;
  tiers: ViewTier[];
}

export interface PricingData {
  basic: PlanPricing;
  pro: PlanPricing;
}

const FALLBACK: PricingData = {
  basic: {
    base: { daily_views: 20, monthly_price: 149, yearly_price: 1490 },
    tiers: [],
  },
  pro: {
    base: { daily_views: 200, monthly_price: 599, yearly_price: 5990 },
    tiers: [],
  },
};

export const usePlanPricing = () => {
  const query = useQuery({
    queryKey: ["plan-pricing"],
    queryFn: async (): Promise<PricingData> => {
      const { data, error } = await supabase.rpc("get_plan_pricing" as any);
      if (error) throw error;
      return data as unknown as PricingData;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    ...query,
    pricing: query.data ?? FALLBACK,
  };
};
