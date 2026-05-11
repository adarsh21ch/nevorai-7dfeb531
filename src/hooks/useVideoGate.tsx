import { useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useHasVideos } from "./useHasVideos";

/**
 * Phase 6/7 gate: any "create" flow that requires an uploaded video calls this.
 * If the user has no videos yet, send them to upload-first onboarding.
 * Returns { ready, hasVideos } so the calling page can render a skeleton until check completes.
 */
export const useVideoGate = (enabled = true) => {
  const navigate = useNavigate();
  const { hasVideos, isLoading } = useHasVideos();

  useEffect(() => {
    if (!enabled || isLoading) return;
    if (!hasVideos) {
      navigate("/onboarding-upload");
    }
  }, [enabled, isLoading, hasVideos, navigate]);

  return { ready: !isLoading, hasVideos };
};
