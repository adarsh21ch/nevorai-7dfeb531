import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Lightweight check: does the current user have at least one uploaded video?
 * Used to drive upload-first onboarding gates across the app.
 */
export const useHasVideos = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["has-videos", user?.id],
    queryFn: async () => {
      if (!user) return { hasVideos: false, latest: null as null | { id: string; title: string; thumbnail_url: string | null; public_url: string | null; created_at: string } };
      const { data: rows } = await supabase
        .from("video_assets")
        .select("id, title, thumbnail_url, public_url, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = rows?.[0] ?? null;
      return { hasVideos: !!latest, latest };
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    hasVideos: data?.hasVideos ?? false,
    latestVideo: data?.latest ?? null,
    isLoading,
  };
};
