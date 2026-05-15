import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";

const FREE_FALLBACK_MB = 1024; // 1 GB

// Map plan.tier ("free" | "basic" | "pro" | "trial") to plan_config.plan_name.
// Trial users get pro-tier storage while their trial is active.
const planNameForTier = (tier: string): string => {
  if (tier === "trial") return "pro";
  if (tier === "basic") return "basic";
  if (tier === "pro") return "pro";
  return "free";
};

export interface StorageUsage {
  usedBytes: number;
  usedGB: number;
  limitBytes: number;
  limitGB: number;
  limitMB: number;
  percent: number;
  isOverLimit: boolean;
  planName: string;
  isLoading: boolean;
  wouldExceed: (additionalBytes: number) => boolean;
}

export const useStorageUsage = (): StorageUsage => {
  const { user } = useAuth();
  const { plan } = usePlan();
  const planName = planNameForTier(plan.tier);

  const { data: usedBytes = 0, isLoading: usageLoading } = useQuery({
    queryKey: ["storage-usage", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("video_assets")
        .select("file_size_bytes")
        .eq("owner_id", user.id);
      if (error || !data) return 0;
      return data.reduce(
        (sum: number, row: { file_size_bytes: number | null }) =>
          sum + (row.file_size_bytes || 0),
        0,
      );
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const { data: limitMB = FREE_FALLBACK_MB, isLoading: limitLoading } = useQuery({
    queryKey: ["storage-limit", planName],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plan_config")
        .select("max_storage_mb")
        .eq("plan_name", planName)
        .maybeSingle();
      // Use `||` (not `??`) so a stored 0 also falls back to the default —
      // a misconfigured plan_config row must not zero out user quotas.
      return data?.max_storage_mb || FREE_FALLBACK_MB;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const limitBytes = limitMB * 1024 * 1024;
  const usedGB = usedBytes / (1024 * 1024 * 1024);
  const limitGB = limitMB / 1024;
  const percent = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  const isOverLimit = usedBytes >= limitBytes;

  return {
    usedBytes,
    usedGB,
    limitBytes,
    limitGB,
    limitMB,
    percent,
    isOverLimit,
    planName,
    isLoading: usageLoading || limitLoading,
    wouldExceed: (additionalBytes: number) =>
      usedBytes + additionalBytes > limitBytes,
  };
};
