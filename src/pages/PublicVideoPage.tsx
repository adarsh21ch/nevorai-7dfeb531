import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import NFlowLogo from "@/components/brand/NFlowLogo";
import {
  Video,
  AlertTriangle,
  Eye,
  Clock,
  Calendar,
  Link2,
  Share2,
  Check,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { BrandingWatermark } from "@/components/BrandingWatermark";
import {
  formatViewCount,
  formatDuration,
  formatRelativeDate,
} from "@/lib/format";
import { toast } from "sonner";

const PublicVideoPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [videoError, setVideoError] = useState(false);
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: video, isLoading, error, refetch } = useQuery({
    queryKey: ["public-video", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("video_assets")
        .select(
          "id, title, description, public_url, thumbnail_url, duration_seconds, is_shared, owner_id, allow_copy_link, allow_seek, allow_playback_speed, view_count, created_at",
        )
        .eq("id", id!)
        .eq("is_shared", true)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // View ping — once per session.
  useEffect(() => {
    if (!id) return;
    const flag = `nflow:viewed:${id}`;
    if (typeof window === "undefined" || sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("video_assets")
          .select("view_count")
          .eq("id", id)
          .maybeSingle();
        const next = (data?.view_count ?? 0) + 1;
        await (supabase as any)
          .from("video_assets")
          .update({ view_count: next })
          .eq("id", id);
      } catch {
        /* silent */
      }
    })();
  }, [id]);

  // Meta tags are handled server-side by the route's head() (see src/routes/v.$id.tsx)
  // so social crawlers (WhatsApp, Telegram, iMessage, Twitter) get them in the
  // initial HTML response without running JavaScript.

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: video?.title ?? "Nevorai video",
      text: "Watch this video on Nevorai",
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share(shareData);
        return;
      } catch {
        /* user dismissed */
      }
    }
    handleCopyLink();
  };

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
          <p className="text-sm text-muted-foreground">
            This video doesn't exist or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const isOwner = !!user && user.id === video.owner_id;
  const showDescToggle =
    !!video.description && video.description.length > 200;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <NFlowLogo size="sm" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Player */}
      <div className="max-w-3xl mx-auto px-0 sm:px-4 mt-4">
        <div className="aspect-video bg-black sm:rounded-2xl overflow-hidden relative">
          {videoError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-4 gap-3 bg-card">
              <AlertTriangle size={36} className="text-destructive" />
              <p className="text-sm font-medium">Video format not supported.</p>
              <p className="text-xs text-muted-foreground">
                Please re-upload as MP4 format.
              </p>
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
              controlsList={
                `${video.allow_seek === false ? "nodownload noplaybackrate " : ""}${
                  video.allow_playback_speed === false ? "noplaybackrate" : ""
                }`.trim() || undefined
              }
              autoPlay
              muted
              preload="auto"
              playsInline
              className="w-full h-full"
              poster={video.thumbnail_url || undefined}
              onError={() => setVideoError(true)}
              ref={(el) => {
                if (!el) return;
                const allowSeek = video.allow_seek !== false;
                const allowSpeed = video.allow_playback_speed !== false;
                const maxRef = { v: 0 };
                el.ontimeupdate = () => {
                  if (el.currentTime > maxRef.v) maxRef.v = el.currentTime;
                };
                el.onseeking = () => {
                  if (!allowSeek && el.currentTime > maxRef.v + 0.5)
                    el.currentTime = maxRef.v;
                };
                el.onratechange = () => {
                  if (!allowSpeed && el.playbackRate !== 1) el.playbackRate = 1;
                };
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Title + meta */}
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        <h1 className="text-xl sm:text-2xl font-heading font-bold leading-tight tracking-tight">
          {video.title || "Untitled video"}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {typeof video.view_count === "number" && video.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {formatViewCount(video.view_count)} views
            </span>
          )}
          {!!video.duration_seconds && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(video.duration_seconds)}
            </span>
          )}
          {video.created_at && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatRelativeDate(video.created_at)}
            </span>
          )}
        </div>

        {/* Action chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {video.allow_copy_link !== false && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 h-11 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-4 h-11 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      {/* Description */}
      {video.description && (
        <div className="max-w-3xl mx-auto px-4 mb-10">
          <div className="rounded-xl bg-muted/50 p-4">
            <div
              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                descExpanded ? "" : "line-clamp-4"
              }`}
            >
              {video.description}
            </div>
            {showDescToggle && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                {descExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        </div>
      )}

      {isOwner && (
        <VideoUploadModal
          open={reuploadOpen}
          onClose={() => setReuploadOpen(false)}
          onSuccess={() => {
            setVideoError(false);
            setReuploadOpen(false);
            refetch();
          }}
        />
      )}

      <BrandingWatermark ownerId={video?.owner_id} />
    </div>
  );
};

export default PublicVideoPage;
