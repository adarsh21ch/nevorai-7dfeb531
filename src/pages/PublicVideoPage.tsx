import { useState, useEffect, useRef } from "react";
import { useParams } from "@/lib/router-compat";
import { startVideoView, heartbeatVideoView } from "@/lib/videoTracking.functions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { VideoPlayer } from "@/components/VideoPlayer";
import {
  Video,
  AlertTriangle,
  Eye,
  Clock,
  Calendar,
  Check,
  Sun,
  Moon,
  X,
  ShieldCheck,
  Lock,
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

const TitleBlock = ({ title }: { title: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Detect whether the clamped element overflows; only then show "...more".
    setOverflows(el.scrollHeight - el.clientHeight > 2);
  }, [title]);
  return (
    <div>
      <h1
        ref={ref}
        className={`text-xl sm:text-2xl font-heading font-semibold leading-tight tracking-tight transition-[max-height] duration-200 ease-out ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {title}
      </h1>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less" : "...more"}
        </button>
      )}
    </div>
  );
};

const PublicVideoPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [videoError, setVideoError] = useState(false);
  const [reuploadOpen, setReuploadOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [openedByApp, setOpenedByApp] = useState(false);
  const trackingRef = useRef<{
    max: number;
    warned: boolean;
    eventId: string | null;
    sessionId: string;
    skipAttempts: number;
    lastBeat: number;
    started: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpenedByApp(Boolean(window.opener));
  }, []);

  const { data: video, isLoading, error, refetch } = useQuery({
    queryKey: ["public-video", id],
    queryFn: async () => {
      const looksLikeUuid =
        !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const column = looksLikeUuid ? "id" : "slug";
      const { data, error } = await (supabase as any)
        .from("video_assets")
        .select("*")
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

  const { data: creatorProfile } = useQuery({
    queryKey: ["public-video-creator", video?.owner_id],
    queryFn: async () => {
      if (!video?.owner_id) return null;
      const { data, error } = await (supabase as any)
        .from("profiles_public")
        .select("id, display_name, avatar_url, is_verified, username, cta_label, cta_url")
        .eq("id", video.owner_id)
        .maybeSingle();
      if (error) return null;
      return data as
        | {
            id: string;
            display_name: string | null;
            avatar_url: string | null;
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

  // Attach tracking to the custom player's video element.
  const handleVideoRef = (el: HTMLVideoElement | null) => {
    if (!el || !video) return;
    if ((el as any).__nflowAttached) return;
    (el as any).__nflowAttached = true;
    const allowSeek = video.allow_seek !== false;
    const allowSpeed = video.allow_playback_speed !== false;

    if (!trackingRef.current) {
      trackingRef.current = {
        max: 0,
        warned: false,
        eventId: null,
        sessionId: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        skipAttempts: 0,
        lastBeat: 0,
        started: false,
      };
    }
    const state = trackingRef.current!;

    const startIfNeeded = async () => {
      if (state.started) return;
      state.started = true;
      try {
        const ua = navigator.userAgent || "";
        const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
        const res = await startVideoView({
          data: {
            videoId: video.id,
            sessionId: state.sessionId,
            durationSeconds: isFinite(el.duration) ? el.duration : (video.duration_seconds ?? null),
            deviceType: device,
            referrerSource: (document.referrer || "direct").slice(0, 200),
          },
        });
        state.eventId = res?.eventId ?? null;
      } catch {
        /* swallow */
      }
    };

    const beat = (completed = false) => {
      if (!state.eventId) return;
      const now = Date.now();
      if (!completed && now - state.lastBeat < 10000) return;
      state.lastBeat = now;
      heartbeatVideoView({
        data: {
          eventId: state.eventId,
          watchPosition: el.currentTime || 0,
          maxPosition: state.max,
          completed,
          skipAttempts: state.skipAttempts,
        },
      }).catch(() => {});
    };

    el.addEventListener("play", () => startIfNeeded());
    el.addEventListener("timeupdate", () => {
      if (el.currentTime > state.max) state.max = el.currentTime;
      beat();
    });
    el.addEventListener("pause", () => beat());
    el.addEventListener("ended", () => beat(true));
    el.addEventListener("seeking", () => {
      if (!allowSeek && el.currentTime > state.max + 0.5) {
        el.currentTime = state.max;
        state.skipAttempts += 1;
        if (!state.warned) {
          state.warned = true;
          toast("This video must be watched in order", { duration: 2500 });
        }
      }
    });
    el.addEventListener("ratechange", () => {
      if (!allowSpeed && el.playbackRate !== 1) el.playbackRate = 1;
    });
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
  const showDescToggle = !!video.description && video.description.length > 200;
  const showVerifiedBadge = verifiedBadgeEnabled && !!creatorProfile?.is_verified;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
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
            <a
              href="https://nevorai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0"
            >
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
        <div className="aspect-video bg-black sm:rounded-2xl overflow-hidden">
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
            <VideoPlayer
              src={video.public_url}
              poster={video.thumbnail_url || undefined}
              allowSeek={video.allow_seek !== false}
              allowPlaybackSpeed={video.allow_playback_speed !== false}
              allowCopyLink={video.allow_copy_link !== false}
              allowDownload={false}
              title={video.title || undefined}
              onVideoRef={handleVideoRef}
              onError={() => setVideoError(true)}
              tracking={video.id ? { videoId: video.id, sourceType: "video", sourceId: video.id } : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Title + creator */}
      <div className="max-w-3xl mx-auto w-full px-4 mt-4 space-y-3">
        <TitleBlock title={video.title || "Untitled video"} />

        {/* Creator row — ALWAYS renders when we have a creator profile (with fallback name) */}
        {(() => {
          const name =
            (creatorProfile?.display_name || "").trim() || "Creator";
          const initial = name[0]?.toUpperCase() || "C";
          const colorIdx =
            Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
          const palette = [
            "bg-amber-500/15 text-amber-600 dark:text-amber-400",
            "bg-rose-500/15 text-rose-600 dark:text-rose-400",
            "bg-sky-500/15 text-sky-600 dark:text-sky-400",
            "bg-violet-500/15 text-violet-600 dark:text-violet-400",
            "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
          ];
          return creatorProfile ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  {creatorProfile.avatar_url ? (
                    <img
                      src={creatorProfile.avatar_url}
                      alt={name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center text-sm font-bold ${palette[colorIdx]}`}
                    >
                      {initial}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-foreground truncate text-sm sm:text-base">
                      {name}
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
                    <div className="text-xs text-muted-foreground truncate">
                      @{creatorProfile.username}
                    </div>
                  )}
                </div>
              </div>
              {creatorProfile.cta_url && creatorProfile.cta_label && (
                <a
                  href={creatorProfile.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-4 h-9 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  {creatorProfile.cta_label} →
                </a>
              )}
            </div>
          ) : null;
        })()}

        {/* Secondary meta row — date · views · duration · subtle distraction-free chip */}
        <div className="flex items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
          {video.created_at && video.show_upload_date !== false && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatRelativeDate(video.created_at)}
            </span>
          )}
          {typeof video.view_count === "number" && video.view_count > 0 && (
            <>
              {video.created_at && video.show_upload_date !== false && <span aria-hidden>·</span>}
              <span className="flex items-center gap-1">
                <Eye size={12} />
                {formatViewCount(video.view_count)} views
              </span>
            </>
          )}
          {!!video.duration_seconds && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(video.duration_seconds)}
              </span>
            </>
          )}
          {video.allow_seek === false && (
            <>
              <span aria-hidden>·</span>
              <span
                title="This video plays start-to-finish for the best experience — seeking is disabled."
                className="inline-flex items-center gap-1"
              >
                <ShieldCheck size={12} />
                Distraction-free
              </span>
            </>
          )}
        </div>
      </div>



      {/* Description */}
      {video.description && (
        <div className="max-w-3xl mx-auto w-full px-4 mt-4 mb-10">
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

      <footer
        className="text-center text-xs sm:text-[13px] text-muted-foreground border-t border-border mt-auto"
        style={{ padding: "20px 16px" }}
      >
        <div className="inline-flex items-center gap-1.5 mb-1.5">
          <Lock size={12} />
          <span>Your information is safe</span>
          <span aria-hidden>·</span>
          <span>
            Powered by{" "}
            <a
              href="https://nevorai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
              style={{ color: "var(--accent-saffron)" }}
            >
              Nevorai
            </a>
          </span>
        </div>
        <div>© 2026 Nevorai · All Rights Reserved · India</div>
      </footer>
    </div>
  );
};

export default PublicVideoPage;
