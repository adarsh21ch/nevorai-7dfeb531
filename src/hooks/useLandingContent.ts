import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnimationKind } from "@/components/landing/AnimatedImage";

export interface LandingSlot {
  id: string;
  section: string;
  sort_order: number;
  title: string | null;
  subtitle: string | null;
  bullets: string[];
  image_url: string | null;
  animation: AnimationKind;
}

export type LandingMap = Record<string, LandingSlot>;

export const useLandingContent = () => {
  return useQuery({
    queryKey: ["landing-content"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("landing_content")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as LandingSlot[];
      const map: LandingMap = {};
      for (const r of rows) {
        map[r.id] = {
          ...r,
          bullets: Array.isArray(r.bullets) ? r.bullets : [],
        };
      }
      return { rows, map };
    },
    staleTime: 1000 * 60 * 5,
  });
};
