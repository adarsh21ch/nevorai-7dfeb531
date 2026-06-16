import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  MoreVertical,
  PictureInPicture2,
  Copy,
  Share2,
  Download,
  MessageCircle,
  Twitter,
  Gauge,
  Loader2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { isYouTubeUrl } from "@/lib/youtube";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { useVideoTracking, type VideoTrackingMeta } from "@/hooks/useVideoTracking";

const SAFFRON = "var(--accent-saffron)";
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  allowSeek?: boolean;
  allowPlaybackSpeed?: boolean;
  allowCopyLink?: boolean;
  allowDownload?: boolean;
  title?: string;
  shareUrl?: string;
  autoplay?: boolean;
  initialTime?: number;
  live?: boolean;
  viewerCount?: number;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onError?: () => void;
  onPlay?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Optional view-tracking metadata. When provided, view events are recorded. */
  tracking?: VideoTrackingMeta;
}

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** 44x44 button wrapper for control bar */
function ControlButton({
  onClick,
  ariaLabel,
  children,
  className,
  hideOnMobile,
}: {
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "h-11 w-11 flex items-center justify-center rounded-md text-white",
        "hover:bg-white/10 active:scale-90 transition-transform",
        hideOnMobile && "hidden sm:inline-flex",
        className,
      )}
    >
      {children}
    </button>
  );
}


export function VideoPlayer(props: VideoPlayerProps) {
  // If source is a YouTube link, render the hardened embed instead of the native player.
  if (isYouTubeUrl(props.src)) {
    return (
      <div className="relative w-full h-full bg-black">
        <YouTubeEmbed
          src={props.src}
          autoplay={props.autoplay !== false}
          initialTime={props.initialTime}
          title={props.title}
        />
      </div>
    );
  }
  return <NativeVideoPlayer {...props} />;
}

function NativeVideoPlayer({
  src,
  poster,
  allowSeek = true,
  allowPlaybackSpeed = true,
  allowCopyLink = true,
  allowDownload = false,
  title,
  shareUrl,
  autoplay = true,
  initialTime,
  live = false,
  viewerCount,
  onVideoRef,
  onError,
  onPlay,
  onTimeUpdate,
  tracking,
}: VideoPlayerProps) {
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const prevRateRef = useRef(1);
  const maxWatchedRef = useRef(0);

  useVideoTracking(videoRef, tracking);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [canPiP, setCanPiP] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [seekHint, setSeekHint] = useState<null | { side: "left" | "right"; amount: number; key: number }>(null);
  const lastTapRef = useRef<{ time: number; x: number; side: "left" | "right" | null }>({ time: 0, x: 0, side: null });
  const resumeKey = useMemo(() => `nflow:resume:${tracking?.videoId ?? src}`, [tracking?.videoId, src]);
  const lastSaveRef = useRef(0);
  // Speed menu is only available when both playback-speed AND seeking are allowed (skip-protected
  // videos lock playback to 1x to preserve creator intent).
  const speedEnabled = allowPlaybackSpeed && allowSeek;

  

  useEffect(() => {
    setCanPiP(typeof document !== "undefined" && !!(document as any).pictureInPictureEnabled);
    setCanNativeShare(typeof navigator !== "undefined" && !!(navigator as any).share);
  }, []);

  useEffect(() => {
    onVideoRef?.(videoRef.current);
  }, [onVideoRef]);

  // Fullscreen change listener
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const hideDelay = isMobile ? 3000 : 2000;

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (!videoRef.current?.paused) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), hideDelay);
    }
  }, [hideDelay]);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);



  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const setVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted = clamped === 0;
    setVolume(clamped);
    setMuted(clamped === 0);
  }, []);

  const seekToFraction = useCallback(
    (frac: number) => {
      if (!allowSeek) return;
      const v = videoRef.current;
      if (!v || !isFinite(v.duration)) return;
      let target = Math.max(0, Math.min(v.duration, frac * v.duration));
      v.currentTime = target;
    },
    [allowSeek],
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (!allowSeek) return;
      const v = videoRef.current;
      if (!v || !isFinite(v.duration)) return;
      v.currentTime = Math.max(0, Math.min(v.duration, (v.currentTime || 0) + delta));
      setSeekHint({ side: delta > 0 ? "right" : "left", amount: Math.abs(delta), key: Date.now() });
    },
    [allowSeek],
  );

  const setRate = useCallback(
    (rate: number) => {
      const v = videoRef.current;
      if (!v) return;
      const effective = speedEnabled ? rate : 1;
      v.playbackRate = effective;
      setPlaybackRate(effective);
    },
    [speedEnabled],
  );


  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
        // Try landscape lock on mobile landscape videos
        try {
          const v = videoRef.current;
          if (v && v.videoWidth > v.videoHeight) {
            const so: any = (screen as any).orientation;
            if (so && typeof so.lock === "function") {
              so.lock("landscape").catch(() => {});
            }
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
      } else {
        await (v as any).requestPictureInPicture();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const key = e.key;
      const v = videoRef.current;
      if (!v) return;
      switch (key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "ArrowUp":
          e.preventDefault();
          setVol(Math.min(1, (v.volume || 0) + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVol(Math.max(0, (v.volume || 0) - 0.1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(5);
          break;
        case "j":
        case "J":
          e.preventDefault();
          seekBy(-10);
          break;
        case "l":
        case "L":
          e.preventDefault();
          seekBy(10);
          break;
        default:
          if (allowSeek && /^[0-9]$/.test(key)) {
            e.preventDefault();
            seekToFraction(parseInt(key, 10) / 10);
          }
      }
      showControls();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, toggleFullscreen, setVol, seekBy, seekToFraction, allowSeek, showControls]);


  const url = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const handleCopy = useCallback(() => {
    try {
      navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  }, [url]);

  const handleShare = useCallback(async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: title ?? "Nevorai video", url });
        return;
      } catch {
        /* dismissed */
      }
    }
    handleCopy();
  }, [handleCopy, title, url]);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = src;
    a.download = title ?? "video";
    a.click();
  }, [src, title]);

  // Touch gestures
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      const v = videoRef.current;
      if (!v) return;
      prevRateRef.current = v.playbackRate || 1;
      longPressTimerRef.current = window.setTimeout(() => {
        if (allowPlaybackSpeed) v.playbackRate = 2;
      }, 500);
    },
    [allowPlaybackSpeed],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const v = videoRef.current;
      if (v && v.playbackRate !== prevRateRef.current) {
        v.playbackRate = prevRateRef.current;
      }
      // Ignore taps that land on interactive controls (let them handle themselves)
      const target = e.target as HTMLElement | null;
      if (target && target.closest("button, input, [role='menu'], [data-no-tap]")) {
        return;
      }
      // Single tap anywhere on video: toggle play/pause + show controls.
      togglePlay();
      showControls();
    },
    [togglePlay, showControls],
  );

  // CRITICAL: also reset speed on touchcancel — without this, a long-press
  // interrupted by a scroll/swipe leaves the video stuck at 2x forever.
  const onTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const v = videoRef.current;
    if (v && v.playbackRate !== prevRateRef.current) {
      v.playbackRate = prevRateRef.current;
    }
  }, []);

  // Safety net: if the tab is backgrounded mid-long-press, snap back to 1x.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        const v = videoRef.current;
        if (v && v.playbackRate !== 1 && v.playbackRate !== prevRateRef.current) {
          v.playbackRate = prevRateRef.current || 1;
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const progressPct = duration > 0 ? (current / duration) * 100 : 0;
  const hoverPct = hoverFrac != null ? hoverFrac * 100 : 0;
  const hoverTime = hoverFrac != null ? hoverFrac * duration : 0;

  const VolumeIcon = useMemo(() => {
    if (muted || volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  }, [muted, volume]);

  // Sizes scale up in fullscreen. Control bar is kept tight to the progress bar.
  const barH = isFs ? "h-14" : isMobile ? "h-12" : "h-11";
  const gradH = isFs ? "h-40" : "h-24 sm:h-28";

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className={cn(
        "relative w-full h-full bg-black outline-none group/player overflow-hidden",
        isFs && "is-fullscreen",
        !controlsVisible && playing && "cursor-none",
      )}
      style={isFs ? { width: "100vw", height: "100vh" } : undefined}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing) {
          cancelHide();
          hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 400);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoplay}
        muted={autoplay}
        playsInline
        preload="auto"
        controls={false}
        controlsList="nodownload"
        className="w-full h-full object-contain"
        onClick={(e) => {
          if ((e as any).pointerType === "touch") return;
          togglePlay();
        }}
        onPlay={() => {
          setPlaying(true);
          onPlay?.();
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          cancelHide();
        }}
        onVolumeChange={(e) => {
          const v = e.currentTarget;
          setVolume(v.volume);
          setMuted(v.muted);
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration || 0);
          setVolume(v.volume);
          setMuted(v.muted);
          if (initialTime && initialTime > 0 && isFinite(initialTime)) {
            try {
              v.currentTime = Math.min(initialTime, v.duration || initialTime);
            } catch {
              /* ignore */
            }
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          if (v.currentTime > maxWatchedRef.current) maxWatchedRef.current = v.currentTime;
          onTimeUpdate?.(v.currentTime, v.duration || 0);
        }}
        onSeeking={(e) => {
          const v = e.currentTarget;
          if (!allowSeek && v.currentTime > maxWatchedRef.current + 0.5) {
            v.currentTime = maxWatchedRef.current;
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          try {
            if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          } catch {
            /* ignore */
          }
        }}
        onRateChange={(e) => {
          if (!allowPlaybackSpeed && e.currentTarget.playbackRate !== 1) {
            e.currentTarget.playbackRate = 1;
          }
        }}
        onError={onError}
      />

      {/* Mobile centered play button */}
      {isMobile && controlsVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="pointer-events-auto h-16 w-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            {playing ? <Pause size={32} fill="white" /> : <Play size={32} fill="white" className="ml-1" />}
          </button>
        </div>
      )}

      {/* Desktop center play overlay when paused */}
      {!isMobile && !playing && controlsVisible && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 z-10"
          aria-label="Play"
        >
          <span className="rounded-full bg-black/60 p-5">
            <Play className="text-white" size={36} fill="white" />
          </span>
        </button>
      )}


      {/* Bottom gradient + controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent transition-opacity duration-200 pointer-events-none",
          gradH,
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 px-3 sm:px-4 transition-opacity duration-200",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onMouseEnter={cancelHide}
      >
        {/* Progress bar (hidden for live) — sits flush above the control bar */}
        {!live && (
          <div
            ref={progressRef}
            className={cn(
              "relative w-full group/seek py-1 sm:py-1",
              allowSeek ? "cursor-pointer" : "cursor-default",
            )}
            onClick={(e) => {
              if (!allowSeek) return;
              const r = e.currentTarget.getBoundingClientRect();
              seekToFraction((e.clientX - r.left) / r.width);
            }}
            onMouseMove={(e) => {
              if (!allowSeek) return;
              const r = e.currentTarget.getBoundingClientRect();
              setHoverFrac(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
            }}
            onMouseLeave={() => setHoverFrac(null)}
          >
            {/* Time tooltip */}
            {allowSeek && hoverFrac != null && duration > 0 && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 text-white text-xs font-medium tabular-nums pointer-events-none"
                style={{ left: `${hoverPct}%` }}
              >
                {fmt(hoverTime)}
              </div>
            )}
            <div
              className={cn(
                "relative w-full rounded-full transition-[height] duration-150 bg-white/25",
                // Mobile: 4px default, 6px active. Desktop: 3px default, 6px on hover. FS: 4px / 8px.
                allowSeek
                  ? isFs
                    ? "h-1 group-hover/seek:h-2 group-active/seek:h-2"
                    : "h-1 sm:h-[3px] group-hover/seek:h-1.5 group-active/seek:h-1.5"
                  : isFs
                    ? "h-1"
                    : "h-1 sm:h-[3px]",
              )}
            >
              <div
                className="absolute top-0 left-0 h-full bg-white/40 rounded-full"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full"
                style={{ width: `${progressPct}%` }}
              />
              {allowSeek && (
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 bg-primary rounded-full",
                    // Mobile: always-visible 12px scrubber. Desktop: 8px, hover-only.
                    "w-3 h-3 -ml-1.5 sm:w-2 sm:h-2 sm:-ml-1",
                    "opacity-100 sm:opacity-0 sm:group-hover/seek:opacity-100 transition-opacity",
                  )}
                  style={{ left: `${progressPct}%` }}
                />
              )}
            </div>
          </div>
        )}

        {/* Control bar */}
        <div className={cn("flex items-center text-white gap-1 sm:gap-1", barH)}>
          <ControlButton onClick={togglePlay} ariaLabel={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={isFs ? 22 : 20} fill="white" /> : <Play size={isFs ? 22 : 20} fill="white" />}
          </ControlButton>

          {/* Volume — simple icon toggle */}
          <ControlButton onClick={toggleMute} ariaLabel={muted ? "Unmute" : "Mute"}>
            <VolumeIcon size={isFs ? 22 : 20} />
          </ControlButton>

          {/* Time display (fixed width, tabular) — or LIVE badge */}
          {live ? (
            <div className="flex items-center gap-2 px-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-xs font-bold tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              {typeof viewerCount === "number" && (
                <span className="text-xs text-white/80 tabular-nums">
                  {viewerCount.toLocaleString()} watching
                </span>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "text-sm text-white/80 px-2 select-none tabular-nums",
                "min-w-[88px]",
                isFs && "text-base min-w-[120px]",
              )}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fmt(current)} / {fmt(duration)}
            </div>
          )}

          <div className="flex-1" />

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-11 w-11 flex items-center justify-center rounded-md text-white hover:bg-white/10 active:scale-90 transition-transform"
                aria-label="More options"
              >
                <MoreVertical size={isFs ? 22 : 20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48">
              {allowCopyLink && (
                <DropdownMenuItem onSelect={handleCopy}>
                  <Copy size={14} className="mr-2" /> Copy link
                </DropdownMenuItem>
              )}
              {canNativeShare ? (
                <DropdownMenuItem onSelect={handleShare}>
                  <Share2 size={14} className="mr-2" /> Share
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(`${title ?? "Watch this"}\n${url}`)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <MessageCircle size={14} className="mr-2" /> WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      window.open(
                        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title ?? "")}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Twitter size={14} className="mr-2" /> Twitter
                  </DropdownMenuItem>
                </>
              )}
              {allowDownload && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDownload}>
                    <Download size={14} className="mr-2" /> Download
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {canPiP && !isMobile && (
            <ControlButton onClick={togglePiP} ariaLabel="Picture in picture" hideOnMobile>
              <PictureInPicture2 size={isFs ? 22 : 20} />
            </ControlButton>
          )}

          <ControlButton onClick={toggleFullscreen} ariaLabel={isFs ? "Exit fullscreen" : "Fullscreen"}>
            {isFs ? <Minimize size={isFs ? 22 : 20} /> : <Maximize size={isFs ? 22 : 20} />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
