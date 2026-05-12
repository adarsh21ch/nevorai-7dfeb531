import { useState } from "react";
import { useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { Video, AlertTriangle, BadgeCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { CopyNflowLinkButton } from "@/components/CopyNflowLinkButton";
import { BrandingWatermark } from "@/components/BrandingWatermark";

const PublicVideoPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [videoError, setVideoError] = useState(false);
  const [reuploadOpen, setReuploadOpen] = useState(false);

  const { data: video, isLoading, error, refetch } = useQuery({
    queryKey: ["public-video", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("id, title, description, public_url, thumbnail_url, duration_seconds, is_shared, owner_id, allow_copy_link, allow_seek, allow_playback_speed")
        .eq("id", id!)
        .eq("is_shared", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Creator identity for the YouTube-style strip beneath the player.
  const { data: creator } = useQuery({
    queryKey: ["public-video-creator", video?.owner_id],
    queryFn: async () => {
      if (!video?.owner_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, city, kyc_status")
        .eq("id", video.owner_id)
        .maybeSingle();
      return data;
    },
    enabled: !!video?.owner_id,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Video size={48} className="text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-heading font-bold mb-2">Video Not Found</h1>
          <p className="text-sm text-muted-foreground">This video doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const isOwner = !!user && user.id === video.owner_id;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-8">
          <Logo size="sm" />
        </div>

        <div className="aspect-video bg-card rounded-xl overflow-hidden mb-6 relative">
          {videoError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-4 gap-3">
              <AlertTriangle size={36} className="text-destructive" />
              <p className="text-sm font-medium">Video format not supported.</p>
              <p className="text-xs text-muted-foreground">Please re-upload as MP4 format.</p>
              {isOwner && (
                <Button size="sm" variant="hero" onClick={() => setReuploadOpen(true)}>
                  Re-upload
                </Button>
              )}
            </div>
          ) : video.public_url ? (
            <video
              src={video.public_url}
              controls
              autoPlay
              muted
              preload="auto"
              playsInline
              className="w-full h-full"
              poster={video.thumbnail_url || undefined}
              onError={() => setVideoError(true)}
              ref={(el) => {
                if (!el) return;
                // Try to play with sound first; fall back to muted autoplay if blocked
                const tryUnmuted = async () => {
                  try {
                    el.muted = false;
                    await el.play();
                  } catch {
                    el.muted = true;
                    el.play().catch(() => {});
                  }
                };
                tryUnmuted();
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-heading font-bold mb-2">{video.title}</h1>

        {/* Creator strip — YouTube-style */}
        {creator && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {creator.avatar_url ? (
                <img src={creator.avatar_url} alt={creator.full_name || "Creator"} className="h-full w-full object-cover" />
              ) : (
                <UserIcon size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-heading font-semibold">{creator.full_name || "Creator"}</p>
                {creator.kyc_status === "verified" && (
                  <span title="Verified creator" className="inline-flex items-center text-primary">
                    <BadgeCheck size={15} />
                  </span>
                )}
              </div>
              {creator.city && <p className="truncate text-xs text-muted-foreground">{creator.city}</p>}
            </div>
          </div>
        )}

        {video.description && <p className="text-sm text-muted-foreground mb-4">{video.description}</p>}
        {video.duration_seconds && (
          <p className="text-xs text-muted-foreground">
            Duration: {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, "0")}
          </p>
        )}

        {/* Copy nFlow Link — viewer-facing reuse button (compact) */}
        {video.allow_copy_link !== false && (
          <div className="mt-4 flex justify-end">
            <CopyNflowLinkButton videoId={video.id} />
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground"><span className="gradient-text font-heading font-semibold">nFlow</span> by Nevorai</p>
        </div>
      </div>

      {isOwner && (
        <VideoUploadModal
          open={reuploadOpen}
          onClose={() => setReuploadOpen(false)}
          onSuccess={() => { setVideoError(false); setReuploadOpen(false); refetch(); }}
        />
      )}
      <BrandingWatermark ownerId={video?.owner_id} />
    </div>
  );
};

export default PublicVideoPage;
