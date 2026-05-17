import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { startVideoView, heartbeatVideoView } from "@/lib/videoTracking.functions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Video,
  AlertTriangle,
  Eye,
  Clock,
  Calendar,
  Share2,
  Check,
  Sun,
  Moon,
  Copy,
  X,
  MessageCircle,
  Twitter,
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
  const [openedByApp, setOpenedByApp] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpenedByApp(Boolean(window.opener));
    setCanNativeShare(typeof navigator !== "undefined" && !!(navigator as any).share);
  }, []);

  const { data: video, isLoading, error, refetch } = useQuery({
    queryKey: ["public-video", id],
    queryFn: async () => {
      const looksLikeUuid =
        !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const column = looksLikeUuid ? "id" : "slug";
      const { data, error } = await (supabase as any)
        .from("video_assets")
        .select(
          "id, slug, title, description, public_url, thumbnail_url, duration_seconds, is_shared, owner_id, allow_copy_link, allow_seek, allow_playback_speed, view_count, created_at",
        )
        .eq(column, id!)
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
        .select("id, full_name, avatar_url, bio, is_verified, username, cta_label, cta_url")
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
            username: string | null;
            cta_label: string | null;
            cta_url: string | null;
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
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="h-0.5 w-full bg-primary" />
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" />
            <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
          </div>
        </header>
        <div className="max-w-3xl mx-auto w-full px-0 sm:px-4 mt-4">
          <div className="aspect-video bg-muted sm:rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/60 to-muted animate-pulse" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-3">
          <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
        </div>
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

        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {openedByApp && (
              <button
                onClick={() => window.close()}
                className="p-2 rounded-full hover:bg-muted transition-colors -ml-2"
                aria-label="Close tab"
                title="Close"
              >
                <X size={18} />
              </button>
            )}
            <a href="https://nevorai.com" target="_blank" rel="noopener noreferrer" className="min-w-0">
              <Logo size="sm" />
            </a>
          </div>
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
                const state: any = (el as any).__trackState || ((el as any).__trackState = {
                  max: 0, warned: false, eventId: null as string | null,
                  sessionId: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
                  skipAttempts: 0, lastBeat: 0, started: false,
                });

                const startIfNeeded = async () => {
                  if (state.started) return;
                  state.started = true;
                  try {
                    const ua = navigator.userAgent || "";
                    const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
                    const res = await startVideoView({ data: {
                      videoId: video.id,
                      sessionId: state.sessionId,
                      durationSeconds: isFinite(el.duration) ? el.duration : (video.duration_seconds ?? null),
                      deviceType: device,
                      referrerSource: (document.referrer || "direct").slice(0, 200),
                    }});
                    state.eventId = res?.eventId ?? null;
                  } catch (e) { /* swallow */ }
                };

                const beat = (completed = false) => {
                  if (!state.eventId) return;
                  const now = Date.now();
                  if (!completed && now - state.lastBeat < 10000) return;
                  state.lastBeat = now;
                  heartbeatVideoView({ data: {
                    eventId: state.eventId,
                    watchPosition: el.currentTime || 0,
                    maxPosition: state.max,
                    completed,
                    skipAttempts: state.skipAttempts,
                  }}).catch(() => {});
                };

                el.onplay = () => { startIfNeeded(); };
                el.ontimeupdate = () => {
                  if (el.currentTime > state.max) state.max = el.currentTime;
                  beat();
                };
                el.onpause = () => beat();
                el.onended = () => beat(true);
                el.onseeking = () => {
                  if (!allowSeek && el.currentTime > state.max + 0.5) {
                    el.currentTime = state.max;
                    state.skipAttempts += 1;
                    if (!state.warned) {
                      state.warned = true;
                      toast("This video must be watched in order", { duration: 2500 });
                    }
                  }
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
        {!videoError && video.public_url && (
          <div className="flex items-center justify-end gap-2 px-4 sm:px-0 pt-3">
            {video.allow_copy_link !== false && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1.5"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-xs">{copied ? "Copied" : "Copy link"}</span>
              </Button>
            )}
            {canNativeShare ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-1.5"
              >
                <Share2 size={14} />
                <span className="text-xs">Share</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <Share2 size={14} />
                    <span className="text-xs">Share</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onSelect={handleCopyLink}>
                    <Copy size={13} className="mr-2" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(
                          `${video?.title ?? "Watch this"}\n${window.location.href}`,
                        )}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <MessageCircle size={13} className="mr-2" /> WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                          window.location.href,
                        )}&text=${encodeURIComponent(video?.title ?? "")}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Twitter size={13} className="mr-2" /> Twitter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
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

        {/* Copy/Share now live in the player overlay (bottom-right) */}
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
              {creatorProfile.username && (
                <p className="text-[11px] text-muted-foreground">@{creatorProfile.username}</p>
              )}
              {creatorProfile.bio && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {creatorProfile.bio}
                </p>
              )}
            </div>
            {creatorProfile.cta_url && creatorProfile.cta_label && (
              <a
                href={creatorProfile.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 h-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {creatorProfile.cta_label} →
              </a>
            )}
          </div>
          <div className="pb-3 -mt-1">
            <span className="text-[11px] text-muted-foreground">
              {video.allow_seek === false ? "🛡️ Skip-protection enabled" : "▶ Standard playback"}
            </span>
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
