import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MoreVertical,
  PictureInPicture2,
  RotateCcw,
  RotateCw,
  Copy,
  Share2,
  Download,
  MessageCircle,
  Twitter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  allowSeek?: boolean;
  allowPlaybackSpeed?: boolean;
  allowCopyLink?: boolean;
  allowDownload?: boolean;
  title?: string;
  shareUrl?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onError?: () => void;
}

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  allowSeek = true,
  allowPlaybackSpeed = true,
  allowCopyLink = true,
  allowDownload = false,
  title,
  shareUrl,
  onVideoRef,
  onError,
}: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);
  const prevRateRef = useRef(1);

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

  useEffect(() => {
    setCanPiP(typeof document !== "undefined" && (document as any).pictureInPictureEnabled);
    setCanNativeShare(typeof navigator !== "undefined" && !!(navigator as any).share);
  }, []);

  // Expose video ref
  useEffect(() => {
    onVideoRef?.(videoRef.current);
  }, [onVideoRef]);

  // Fullscreen change listener
  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement === wrapRef.current;
      setIsFs(fs);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (!videoRef.current?.paused) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2000);
    }
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Play/pause
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const skip = useCallback(
    (delta: number) => {
      if (!allowSeek) return;
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    },
    [allowSeek],
  );

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
      v.currentTime = Math.max(0, Math.min(v.duration, frac * v.duration));
    },
    [allowSeek],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
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
      // ignore when typing in inputs
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
        case "ArrowLeft":
          if (allowSeek) {
            e.preventDefault();
            skip(-5);
          }
          break;
        case "ArrowRight":
          if (allowSeek) {
            e.preventDefault();
            skip(5);
          }
          break;
        case "j":
        case "J":
          if (allowSeek) {
            e.preventDefault();
            skip(-10);
          }
          break;
        case "l":
        case "L":
          if (allowSeek) {
            e.preventDefault();
            skip(10);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          setVol(Math.min(1, (v.volume || 0) + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVol(Math.max(0, (v.volume || 0) - 0.1));
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
  }, [togglePlay, toggleMute, toggleFullscreen, skip, setVol, seekToFraction, allowSeek, showControls]);

  // Copy / share / download
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
      // Detect tap / double-tap
      const touch = e.changedTouches[0];
      if (!touch) return;
      const now = Date.now();
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = touch.clientX - rect.left;
      const last = lastTapRef.current;
      if (last && now - last.t < 300 && Math.abs(x - last.x) < 60) {
        // Double tap
        if (allowSeek) {
          if (x < rect.width / 2) skip(-10);
          else skip(10);
        }
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { t: now, x };
        // Single tap toggles controls after delay
        window.setTimeout(() => {
          if (lastTapRef.current && lastTapRef.current.t === now) {
            setControlsVisible((vis) => !vis);
            lastTapRef.current = null;
          }
        }, 320);
      }
    },
    [allowSeek, skip],
  );

  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

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
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        controlsList="nodownload"
        disablePictureInPicture={false}
        className="w-full h-full object-contain"
        onClick={(e) => {
          // Desktop click to play/pause (ignore on touch)
          if ((e as any).pointerType === "touch") return;
          togglePlay();
        }}
        onPlay={() => {
          setPlaying(true);
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
        }}
        onTimeUpdate={(e) => {
          setCurrent(e.currentTarget.currentTime);
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
        onSeeking={(e) => {
          if (!allowSeek) {
            // FunnelPage parent may also enforce; here we just prevent forward
            // by snapping back if needed — parent ref handles max tracking.
          }
        }}
        onError={onError}
      />

      {/* Center play overlay when paused */}
      {!playing && controlsVisible && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20"
          aria-label="Play"
        >
          <span className="rounded-full bg-black/60 p-5">
            <Play className="text-white" size={36} fill="white" />
          </span>
        </button>
      )}

      {/* Bottom control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 px-3 sm:px-4 pt-10 pb-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent transition-opacity duration-200",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onMouseEnter={cancelHide}
      >
        {/* Progress bar */}
        <div
          className="relative h-1 w-full mb-2 group/seek cursor-pointer"
          onClick={(e) => {
            if (!allowSeek) return;
            const r = e.currentTarget.getBoundingClientRect();
            seekToFraction((e.clientX - r.left) / r.width);
          }}
        >
          <div className="absolute inset-0 bg-white/25 rounded-full" />
          <div
            className="absolute top-0 left-0 h-full bg-white/40 rounded-full"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full -ml-1.5 opacity-0 group-hover/seek:opacity-100 transition-opacity"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-1 text-white">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 hover:bg-white/10 rounded"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
          </button>

          {allowSeek && (
            <>
              <button
                type="button"
                onClick={() => skip(-10)}
                className="p-2 hover:bg-white/10 rounded hidden sm:inline-flex"
                aria-label="Skip back 10s"
              >
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                onClick={() => skip(10)}
                className="p-2 hover:bg-white/10 rounded hidden sm:inline-flex"
                aria-label="Skip forward 10s"
              >
                <RotateCw size={18} />
              </button>
            </>
          )}

          {/* Volume */}
          <div className="flex items-center group/vol">
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 hover:bg-white/10 rounded"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-primary cursor-pointer"
              aria-label="Volume"
            />
          </div>

          {/* Time */}
          <div className="text-xs tabular-nums px-2 select-none">
            {fmt(current)} / {fmt(duration)}
          </div>

          <div className="flex-1" />

          {/* 3-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-2 hover:bg-white/10 rounded"
                aria-label="More options"
              >
                <MoreVertical size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-44">
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

          {canPiP && (
            <button
              type="button"
              onClick={togglePiP}
              className="p-2 hover:bg-white/10 rounded hidden sm:inline-flex"
              aria-label="Picture in picture"
            >
              <PictureInPicture2 size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/10 rounded"
            aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
