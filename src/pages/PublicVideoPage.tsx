import { useState, useEffect, useRef } from "react";
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
  Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { VideoUploadModal } from "@/components/VideoUploadModal";
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
  const isDark = theme === "dark";
  const [videoError, setVideoError] = useState(false);
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerWrapRef = useRef<HTMLDivElement | null>(null);

  const requestWrapperFullscreen = () => {
    const w: any = playerWrapRef.current;
    const doc: any = document;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (isFs) {
      (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
      return;
    }
    if (w?.requestFullscreen) w.requestFullscreen().catch(() => {});
    else if (w?.webkitRequestFullscreen) w.webkitRequestFullscreen();
  };

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

  // Creator profile (owner of the video)
  const { data: creatorProfile } = useQuery({
    queryKey: ["public-video-creator", video?.owner_id],
    queryFn: async () => {
      if (!video?.owner_id) return null;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, avatar_url, bio, is_verified")
        .eq("id", video.owner_id)
        .maybeSingle();
      if (error) return null;
      return data as
        | {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
            bio: string | null;
            is_verified: boolean | null;
          }
        | null;
    },
    enabled: !!video?.owner_id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Global verified-badge enabled flag (admin-controlled).
  // If the row is missing or the column doesn't exist yet, default to true.
  const { data: verifiedBadgeEnabled = true } = useQuery({
    queryKey: ["app-setting", "verified_badge_enabled"],
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("app_settings")
          .select("value")
          .eq("key", "verified_badge_enabled")
          .maybeSingle();
        if (!data) return true;
        return data.value === "true" || data.value === true;
      } catch {
        return true;
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
  const showVerifiedBadge =
    verifiedBadgeEnabled && !!creatorProfile?.is_verified;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        {/* 2px brand accent line at top */}
        <div className="h-0.5 w-full bg-primary" />

        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="https://nevorai.com" target="_blank" rel="noopener noreferrer"><NFlowLogo size="sm" /></a>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Player */}
      <div className="max-w-3xl mx-auto w-full px-0 sm:px-4 mt-4">
        <div ref={playerWrapRef} className="aspect-video bg-black sm:rounded-2xl overflow-hidden relative">
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
                `nofullscreen ${video.allow_seek === false ? "nodownload noplaybackrate " : ""}${
                  video.allow_playback_speed === false ? "noplaybackrate" : ""
                }`.trim()
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
          {!videoError && video.public_url && (
            <div
              style={{
                position: "absolute",
                bottom: 56,
                right: 12,
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.3px",
                pointerEvents: "none",
                userSelect: "none",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                zIndex: 10,
              }}
            >
              nevorai.com
            </div>
          )}
          {!videoError && video.public_url && (
            <button
              type="button"
              onClick={requestWrapperFullscreen}
              aria-label="Toggle fullscreen"
              className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white/90 backdrop-blur-sm transition-colors"
            >
              <Maximize size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Title + meta */}
      <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-3">
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

        {/* Action chips — icon+text on desktop, icon-only on mobile */}
        <div className="flex flex-wrap gap-2 pt-1">
          {video.allow_copy_link !== false && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
              title="Copy link"
              aria-label="Copy link"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy link"}
              </span>
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
            title="Share"
            aria-label="Share"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      {/* Creator card */}
      {creatorProfile && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-2">
          <div className="flex items-center gap-3 py-3 border-t border-border">
            <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 overflow-hidden">
              {creatorProfile.avatar_url ? (
                <img
                  src={creatorProfile.avatar_url}
                  alt={creatorProfile.full_name || "Creator"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                  {(creatorProfile.full_name || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm truncate">
                  {creatorProfile.full_name || "Creator"}
                </span>
                {showVerifiedBadge && (
                  <span
                    title="Verified creator"
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground flex-shrink-0"
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
              {creatorProfile.bio && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {creatorProfile.bio}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {video.description && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-10">
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

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px 16px", color: "#9ca3af", fontSize: 13, borderTop: "1px solid hsl(var(--border))", marginTop: "auto" }}>
        © 2026 Nevorai · All Rights Reserved · India
      </footer>
    </div>
  );
};

export default PublicVideoPage;
