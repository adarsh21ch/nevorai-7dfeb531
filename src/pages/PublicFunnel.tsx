import { useParams, Link } from "@/lib/router-compat";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase, supabaseProjectUrl, supabasePublishableKey } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Play, Pause, MessageCircle, Phone as PhoneIcon, Lock, Check,
  AlertTriangle, BadgeCheck, Volume2, VolumeX,
  Maximize, Minimize, Share2, Loader2, Gauge, Sun, Moon
} from "lucide-react";
import logoImg from "@/assets/nevorai-flow-logo.png";
import { MultiStepViewer } from "@/components/funnel/MultiStepViewer";
import { CodeGateScreen } from "@/components/funnel/CodeGateScreen";
import { PrivateLeadForm } from "@/components/funnel/PrivateLeadForm";
import { FunnelDailyLimitGate } from "@/components/funnel/FunnelDailyLimitGate";
import { CreatorInactiveGate } from "@/components/funnel/CreatorInactiveGate";
import { CopyNflowLinkButton } from "@/components/CopyNflowLinkButton";
import { sanitizeText } from "@/lib/sanitize";
import { trackEntityView, captureAttribution } from "@/lib/tracking";
import {
  normalizePhone,
  trimSmart,
  validatePhone,
  validateEmail,
  validateRequired,
  phoneInputProps,
  emailInputProps,
  nameInputProps,
  cityInputProps,
  scrollToFirstError,
} from "@/lib/leadInputs";
import { PrivacyMicrocopy } from "@/components/funnel/PrivacyMicrocopy";


/* ─── Speed Popover ─── */
const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const SpeedControl = ({
  currentSpeed,
  onSpeedChange,
}: {
  currentSpeed: number;
  onSpeedChange: (s: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-1 px-2 py-1 text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors tabular-nums"
      >
        <Gauge size={14} />
        {currentSpeed === 1 ? "1x" : `${currentSpeed}x`}
      </button>
      {open && (
        <div
          className="absolute bottom-full mb-2 right-0 bg-[#1a1a22] border border-white/10 rounded-xl p-1 shadow-2xl shadow-black/50 min-w-[100px] z-50"
          onClick={(e) => e.stopPropagation()}
        >
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { onSpeedChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${
                currentSpeed === s
                  ? "bg-primary/20 text-primary font-semibold"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {s}x {s === 1 && <span className="text-[11px] text-white/40 ml-1">Normal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Custom Video Player ─── */
const CustomVideoPlayer = ({
  src,
  poster,
  allowSeek,
  allowSpeed,
  autoplay = false,
  initialTime = 0,
  onTimeUpdate,
  onPlay,
}: {
  src: string;
  poster?: string;
  allowSeek: boolean;
  allowSpeed: boolean;
  autoplay?: boolean;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxWatched = useRef(0);
  const isSeeking = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [started, setStarted] = useState(autoplay);
  const [isLoading, setIsLoading] = useState(autoplay);
  const [speed, setSpeed] = useState(1);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [seekToast, setSeekToast] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [centerFlash, setCenterFlash] = useState<{ kind: "play" | "pause"; key: number } | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ side: "left" | "right"; key: number } | null>(null);
  const userPaused = useRef(false);

  const seekToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTapInfo = useRef<{ time: number; side: "left" | "right" | null }>({ time: 0, side: null });
  const autoplayAttempted = useRef(false);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!autoplay || autoplayAttempted.current || !videoRef.current) return;
    autoplayAttempted.current = true;
    const v = videoRef.current;

    v.muted = true;
    setMuted(true);
    setAutoplayMuted(true);
    const playPromise = v.play();
    if (playPromise) {
      playPromise
        .then(() => {
          setStarted(true);
          setPlaying(true);
          onPlay?.();
        })
        .catch(() => {
          setAutoplayMuted(false);
          setStarted(false);
          setPlaying(false);
        });
    }
  }, [autoplay, src, onPlay]);

  const flashCenter = (kind: "play" | "pause") => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setCenterFlash({ kind, key: Date.now() });
    flashTimer.current = setTimeout(() => setCenterFlash(null), 600);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!started) {
      setIsLoading(true);
      setStarted(true);
      userPaused.current = false;
      v.play().catch(() => {});
      onPlay?.();
      flashCenter("play");
    } else if (v.paused) {
      userPaused.current = false;
      v.play();
      flashCenter("play");
    } else {
      userPaused.current = true;
      v.pause();
      flashCenter("pause");
    }
  }, [started, onPlay]);

  const handleUnmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setAutoplayMuted(false);
  }, []);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }, []);

  const showSeekDisabledToast = useCallback(() => {
    if (seekToastTimer.current) clearTimeout(seekToastTimer.current);
    setSeekToast(true);
    seekToastTimer.current = setTimeout(() => setSeekToast(false), 2500);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    let target = v.currentTime + delta;
    if (target < 0) target = 0;
    if (!allowSeek && delta > 0 && target > maxWatched.current + 0.5) {
      showSeekDisabledToast();
      return;
    }
    if (v.duration && target > v.duration) target = v.duration;
    v.currentTime = target;
  }, [allowSeek, showSeekDisabledToast]);

  const flashRipple = (side: "left" | "right") => {
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    setSeekRipple({ side, key: Date.now() });
    rippleTimer.current = setTimeout(() => setSeekRipple(null), 600);
  };

  const onSurfaceTap = (clientX: number, rect: DOMRect) => {
    if (!started) {
      togglePlay();
      return;
    }
    const half = rect.left + rect.width / 2;
    const side: "left" | "right" = clientX < half ? "left" : "right";
    const now = Date.now();
    const last = lastTapInfo.current;
    const isDouble = last.side === side && now - last.time < 300;

    if (isDouble) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = undefined;
      }
      lastTapInfo.current = { time: 0, side: null };
      if (side === "left") { seekBy(-10); flashRipple("left"); }
      else { seekBy(10); flashRipple("right"); }
      return;
    }

    lastTapInfo.current = { time: now, side };
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      togglePlay();
      singleTapTimer.current = undefined;
    }, 260);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      }
      if (!allowSeek) {
        if (["ArrowRight", "l", "L"].includes(e.key)) {
          e.preventDefault();
          showSeekDisabledToast();
        }
        if ("123456789".includes(e.key)) {
          const v = videoRef.current;
          if (v) {
            const target = v.duration * (parseInt(e.key) / 10);
            if (target > maxWatched.current + 1) {
              e.preventDefault();
              showSeekDisabledToast();
            }
          }
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(10);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-10);
      }
      if (e.key === "m" || e.key === "M") {
        setMuted((p) => { if (videoRef.current) videoRef.current.muted = !p; return !p; });
        setAutoplayMuted(false);
      }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [allowSeek, togglePlay, showSeekDisabledToast, seekBy]);

  const toggleFullscreen = () => {
    const videoEl = videoRef.current;
    const wrapperEl = containerRef.current;
    if (!videoEl) return;

    const doc: any = document;
    const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
    if (isFs) {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      return;
    }

    // Prefer wrapper fullscreen so the watermark overlay stays visible.
    const w: any = wrapperEl;
    if (w?.requestFullscreen) { w.requestFullscreen().catch(() => {}); return; }
    if (w?.webkitRequestFullscreen) { w.webkitRequestFullscreen(); return; }
    if (w?.mozRequestFullScreen) { w.mozRequestFullScreen(); return; }
    if (w?.msRequestFullscreen) { w.msRequestFullscreen(); return; }
    // iOS Safari fallback (only the <video> can go fullscreen).
    const v: any = videoEl;
    if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch {} }
  };

  useEffect(() => {
    const onChange = () => {
      const doc: any = document;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("mozfullscreenchange", onChange);
    const v = videoRef.current;
    const onIosBegin = () => setIsFullscreen(true);
    const onIosEnd = () => setIsFullscreen(false);
    v?.addEventListener("webkitbeginfullscreen", onIosBegin);
    v?.addEventListener("webkitendfullscreen", onIosEnd);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("mozfullscreenchange", onChange);
      v?.removeEventListener("webkitbeginfullscreen", onIosBegin);
      v?.removeEventListener("webkitendfullscreen", onIosEnd);
    };
  }, []);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || isSeeking.current) return;
    if (v.currentTime > maxWatched.current) maxWatched.current = v.currentTime;
    setCurrent(v.currentTime);
    onTimeUpdate?.(v.currentTime, v.duration);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
  };

  const handleSeeking = () => {
    const v = videoRef.current;
    if (!v || allowSeek) return;
    if (v.currentTime > maxWatched.current + 0.5) {
      isSeeking.current = true;
      v.currentTime = maxWatched.current;
      showSeekDisabledToast();
      requestAnimationFrame(() => { isSeeking.current = false; });
    }
  };

  const seekToClientX = (clientX: number, rect: DOMRect) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const target = pct * duration;
    if (!allowSeek && target > maxWatched.current + 0.5) {
      v.currentTime = maxWatched.current;
      showSeekDisabledToast();
    } else {
      v.currentTime = target;
    }
  };

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch {}
    seekToClientX(e.clientX, el.getBoundingClientRect());
    const onMove = (ev: PointerEvent) => seekToClientX(ev.clientX, el.getBoundingClientRect());
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      try { el.releasePointerCapture(e.pointerId); } catch {}
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  };

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const watchedPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const maxWatchedPct = duration ? (maxWatched.current / duration) * 100 : 0;

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    handleSpeedChange(next);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-2xl overflow-hidden group select-none"
      style={{ aspectRatio: "16 / 9", minHeight: 0 }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onLoadedMetadata={() => { if (videoRef.current) { setDuration(videoRef.current.duration); if (initialTime > 0) videoRef.current.currentTime = initialTime; } }}
        onPlay={() => { setPlaying(true); setIsLoading(false); }}
        onPause={() => setPlaying(false)}
        onPlaying={() => { setIsBuffering(false); setIsLoading(false); }}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={() => { setLoadError(true); setIsLoading(false); setIsBuffering(false); }}
      />

      {loadError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center bg-black/80 backdrop-blur-sm px-4 gap-2">
          <div className="text-destructive text-sm font-medium">⚠️ Video format not supported.</div>
          <div className="text-white/80 text-xs">Please re-upload as MP4 format.</div>
        </div>
      )}

      <div
        className="absolute right-3 text-[12px] font-medium pointer-events-none select-none z-10"
        style={{ bottom: 56, color: "rgba(255,255,255,0.7)", letterSpacing: "0.3px", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
      >
        nevorai.com
      </div>

      {autoplayMuted && started && muted && (
        <button
          onClick={(e) => { e.stopPropagation(); handleUnmute(); }}
          className="absolute top-4 left-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-[13px] font-semibold shadow-xl whitespace-nowrap nf-unmute-pulse"
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          <VolumeX size={16} />
          <span>Tap to unmute</span>
        </button>
      )}

      {!started && !autoplay && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10">
            <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-primary/25 backdrop-blur-sm">
              <Play size={36} className="ml-1 text-white" />
            </button>
          </div>
        </div>
      )}

      {!started && autoplay && !playing && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer z-20"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10">
            <button className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-primary/25 backdrop-blur-sm">
              <Play size={36} className="ml-1 text-white" />
            </button>
          </div>
        </div>
      )}

      {seekToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-black/80 backdrop-blur-sm rounded-xl border border-white/10 text-white text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-xl">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span>Skipping forward is not allowed for this video</span>
        </div>
      )}

      {(isLoading || isBuffering) && started && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <Loader2 size={40} className="text-white/90 animate-spin" />
        </div>
      )}

      {centerFlash && (
        <div key={centerFlash.key} className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="w-20 h-20 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center nf-center-flash">
            {centerFlash.kind === "play"
              ? <Play size={36} className="ml-1 text-white" />
              : <Pause size={36} className="text-white" />}
          </div>
        </div>
      )}

      {seekRipple && (
        <div
          key={seekRipple.key}
          className={`absolute inset-y-0 ${seekRipple.side === "left" ? "left-0" : "right-0"} w-1/2 flex items-center justify-center pointer-events-none z-30 overflow-hidden`}
        >
          <div className="nf-ripple flex flex-col items-center gap-1 text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            <div className="text-3xl font-bold leading-none">{seekRipple.side === "left" ? "«" : "»"}</div>
            <div className="text-xs font-semibold tracking-wide">10s</div>
          </div>
        </div>
      )}

      {started && !playing && !isLoading && !centerFlash && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
            <Play size={28} className="ml-1 text-white" />
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 z-20 cursor-pointer"
        onClick={(e) => onSurfaceTap(e.clientX, (e.currentTarget as HTMLElement).getBoundingClientRect())}
      />

      {started && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
            showControls || !playing ? "md:opacity-100" : "md:opacity-0 md:pointer-events-none"
          } opacity-100`}
          onClick={(e) => e.stopPropagation()}
          style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}
        >
          <div
            className="h-1 mx-3 mt-3 cursor-pointer relative group/bar rounded-full transition-[height] hover:h-1.5"
            onPointerDown={handleProgressPointerDown}
          >
            <div className="absolute inset-0 rounded-full bg-white/15" />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-[width] duration-200" style={{ width: `${bufferedPct}%` }} />
            {!allowSeek && (
              <div className="absolute inset-y-0 rounded-r-full bg-white/[0.04]" style={{ left: `${maxWatchedPct}%`, right: 0 }} />
            )}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
              style={{ width: `${watchedPct}%`, background: allowSeek ? "#ef4444" : "hsl(var(--primary))" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2 ring-white shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity"
              style={{ left: `calc(${watchedPct}% - 6px)`, background: allowSeek ? "#ef4444" : "hsl(var(--primary))" }}
            />
          </div>

          <div className="flex items-center gap-1 px-3 py-2 text-white">
            <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>

            <button onClick={() => seekBy(-10)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors hidden sm:inline-flex" title="Rewind 10s" aria-label="Rewind 10 seconds">
              <span className="text-[11px] font-bold tracking-tight">«10</span>
            </button>

            {allowSeek && (
              <button onClick={() => seekBy(10)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors hidden sm:inline-flex" title="Forward 10s" aria-label="Forward 10 seconds">
                <span className="text-[11px] font-bold tracking-tight">10»</span>
              </button>
            )}

            <span className="tabular-nums text-white text-[12px] font-medium ml-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
              {fmt(currentTime)}<span className="text-white/60 mx-1">/</span>{fmt(duration)}
            </span>

            <div className="flex-1" />

            <div className="relative flex items-center group/vol">
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  setMuted(v === 0);
                }}
                className="hidden sm:block absolute right-full mr-1 w-0 group-hover:w-20 group-focus-within:w-20 group-hover/vol:w-20 transition-[width] duration-200 accent-white"
                aria-label="Volume"
              />
              <button
                onClick={() => { setMuted((p) => { if (videoRef.current) videoRef.current.muted = !p; return !p; }); setAutoplayMuted(false); }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted || volume === 0 ? <VolumeX size={17} className="text-white" /> : <Volume2 size={17} className="text-white" />}
              </button>
            </div>

            {allowSpeed && (
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 hover:bg-white/10 rounded-lg transition-colors text-[11px] font-bold tabular-nums min-w-[40px]"
                title="Playback speed"
                aria-label="Playback speed"
              >
                {speed}x
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 sm:p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Fullscreen"
            >
              {isFullscreen ? <Minimize size={18} className="text-white" /> : <Maximize size={18} className="text-white" />}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .nf-center-flash { animation: nfCenterFlash 600ms ease-out forwards; }
        @keyframes nfCenterFlash {
          0%   { opacity: 0; transform: scale(0.7); }
          30%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        .nf-ripple { animation: nfRipple 600ms ease-out forwards; }
        @keyframes nfRipple {
          0%   { opacity: 0; transform: scale(0.6); }
          25%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        .nf-unmute-pulse { animation: nfUnmutePulse 2s ease-in-out infinite; }
        @keyframes nfUnmutePulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50%      { transform: translateX(-50%) scale(1.05); }
        }
      `}</style>
    </div>
  );
};

/* ─── Main Page ─── */
const PublicFunnel = () => {
  const { slug } = useParams<{ slug: string }>();
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", city: "", custom_value: "", website: "" });
  const [leadErrors, setLeadErrors] = useState<Record<string, string | null>>({});
  const leadRefs = useRef<Record<string, HTMLElement | null>>({});
  const [paymentProof, setPaymentProof] = useState({ upi_transaction_id: "", amount: 0 });
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [codeGateUnlocked, setCodeGateUnlocked] = useState(false);
  const [privateLeadSubmitted, setPrivateLeadSubmitted] = useState(false);
  const [pubTheme, setPubTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("nevorai-public-theme");
    return saved === "light" ? "light" : "dark";
  });
  const isDark = pubTheme === "dark";
  const togglePubTheme = () => {
    setPubTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("nevorai-public-theme", next);
      return next;
    });
  };

  const tc = {
    bg: isDark ? "#09090b" : "#ffffff",
    bgCard: isDark ? "#141419" : "#f8f9fa",
    border: isDark ? "#27272a" : "#e5e7eb",
    borderSubtle: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "#cbd5e1" : "#64748b",
    textDim: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
    textDimmer: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.3)",
    inputBg: isDark ? "#09090b" : "#f1f5f9",
    inputBorder: isDark ? "#27272a" : "#d1d5db",
    inputText: isDark ? "#ffffff" : "#0f172a",
    placeholder: isDark ? "#64748b" : "#9ca3af",
    headerBg: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
    shareText: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.4)",
    shareHover: isDark ? "#ffffff" : "rgba(0,0,0,0.7)",
    contactBg: isDark ? "rgba(9,9,11,0.95)" : "rgba(255,255,255,0.95)",
    footerText: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)",
    footerBorder: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
  };

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["public-funnel-bundle", slug],
    queryFn: async () => {
      const requestUrl = `${supabaseProjectUrl}/functions/v1/get-funnel-data?slug=${encodeURIComponent(slug ?? "")}`;
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
        },
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
      }

      return payload;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const funnel = bundle?.funnel;
  const videoAsset = bundle?.video;
  const creatorProfile = bundle?.creator;
  const creatorActive = bundle ? bundle.creatorActive !== false : true;
  const formConfig = bundle?.formConfig;
  const priceOptions: any[] = bundle?.priceOptions || [];
  const funnelSteps: any[] = bundle?.steps || [];
  const isMultiStep = funnel?.funnel_mode === "multi" && funnelSteps.length > 0;

  const canView = funnel && funnel.is_published;
  const isPrivateFunnel = funnel?.visibility === "private";
  const requiredFields = funnel?.required_fields || { email: false, city: false, state: false, whatsapp: false };

  const [dailyLimitState, setDailyLimitState] = useState<"unknown" | "allowed" | "blocked">("unknown");
  useEffect(() => {
    if (!funnel?.id) return;
    const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessionKey = `nf_view_check_${funnel.owner_id || funnel.id}_${todayIST}`;
    if (sessionStorage.getItem(sessionKey)) {
      setDailyLimitState("allowed");
      return;
    }
    let visitorSession = localStorage.getItem("nf_visitor_session");
    if (!visitorSession) {
      visitorSession = crypto.randomUUID();
      localStorage.setItem("nf_visitor_session", visitorSession);
    }
    const sessionId = `${visitorSession}_${funnel.owner_id || funnel.id}_${todayIST}`;

    (async () => {
      try {
        const { data } = await supabase.functions.invoke("check-funnel-view-limit", {
          body: { funnelId: funnel.id, sessionId },
        });
        if (data?.allowed === false) {
          setDailyLimitState("blocked");
        } else {
          setDailyLimitState("allowed");
          sessionStorage.setItem(sessionKey, "1");
        }
      } catch {
        setDailyLimitState("allowed");
      }
    })();
  }, [funnel?.id, funnel?.owner_id]);

  useEffect(() => {
    if (!funnel?.id) return;
    return trackEntityView("funnel", funnel.id);
  }, [funnel?.id]);

  useEffect(() => {
    if (!funnel) return;
    const codeVerified = localStorage.getItem(`nf_code_verified_${funnel.id}`);
    if (codeVerified) setCodeGateUnlocked(true);
    const leadStored = localStorage.getItem(`nf_lead_${funnel.id}`);
    if (leadStored) setPrivateLeadSubmitted(true);
  }, [funnel]);

  useEffect(() => {
    if (!funnel || funnel.cta_enabled !== true) return;
    if (!funnel.cta_timing_seconds) {
      setShowCta(true);
      return;
    }
    if (watchSeconds >= funnel.cta_timing_seconds) {
      setShowCta(true);
    }
  }, [funnel, watchSeconds]);

  useEffect(() => {
    if (!funnel) return;
    document.title = `${funnel.title} | Nevorai`;
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", funnel.description || funnel.title);
    setMeta("og:title", funnel.title, true);
    setMeta("og:description", funnel.description || funnel.title, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", window.location.href, true);
    if (funnel.thumbnail_url) setMeta("og:image", funnel.thumbnail_url, true);
    setMeta("og:site_name", "Nevorai", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", funnel.title);
    setMeta("twitter:description", funnel.description || funnel.title);
    if (funnel.thumbnail_url) setMeta("twitter:image", funnel.thumbnail_url);
  }, [funnel]);

  useEffect(() => {
    if (!funnel || !videoPlaying) return;
    const interval = setInterval(() => {
      localStorage.setItem(`nevora_progress_${funnel.id}`, JSON.stringify({ lastPosition: watchSeconds, watchedAt: Date.now() }));
    }, 5000);
    return () => clearInterval(interval);
  }, [funnel, videoPlaying, watchSeconds]);

  const submitLead = useMutation({
    mutationFn: async () => {
      if (leadForm.website) return;
      const s = (v: string | null | undefined) => (v ? sanitizeText(v) : null);
      await (supabase.from("funnel_leads") as any).insert({
        funnel_id: funnel!.id,
        name: s(leadForm.name), phone: leadForm.phone ? normalizePhone(leadForm.phone) : null,
        email: s(leadForm.email), city: s(leadForm.city),
        custom_value: s(leadForm.custom_value),
        watch_progress_at_submit: watchSeconds,
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
        ...captureAttribution("funnel", funnel!.id, funnel!.slug),
      });
    },
    onSuccess: () => { setLeadSubmitted(true); toast.success("Thank you! Your details have been submitted."); },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      await supabase.from("funnel_payments").insert({
        funnel_id: funnel!.id,
        amount: paymentProof.amount || priceOptions[0]?.amount || 0,
        upi_transaction_id: paymentProof.upi_transaction_id || null,
        payment_type: "upi_manual",
      });
    },
    onSuccess: () => { setPaymentSubmitted(true); toast.success("Payment proof submitted!"); },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: tc.bg }}>
      <Loader2 size={32} className="text-primary animate-spin" />
    </div>
  );

  if (bundle && (bundle as any).blocked === true) {
    return <CreatorInactiveGate creatorName={(bundle as any).creator?.full_name || (bundle as any).creator?.display_name} />;
  }

  if (!canView) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
      <div className="text-center">
        <h1 className="text-xl font-heading font-bold mb-2" style={{ color: tc.text }}>Funnel Not Found</h1>
        <p className="text-sm" style={{ color: tc.textMuted }}>This funnel doesn't exist or has been unpublished.</p>
      </div>
    </div>
  );

  if (!creatorActive) return <CreatorInactiveGate creatorName={creatorProfile?.full_name || creatorProfile?.display_name} />;

  if (dailyLimitState === "blocked") return <FunnelDailyLimitGate />;

  if (funnel.visibility === "password" && !passwordUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
        <div className="rounded-2xl p-8 w-full max-w-sm text-center" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
          <Lock size={32} className="text-primary mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold mb-2" style={{ color: tc.text }}>{funnel.title}</h2>
          <p className="text-sm mb-4" style={{ color: tc.textMuted }}>This funnel is password protected.</p>
          <Input type="password" placeholder="Enter password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="mb-3" />
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setPasswordUnlocked(true)}>Unlock</Button>
        </div>
      </div>
    );
  }

  if (isPrivateFunnel && !codeGateUnlocked) {
    return (
      <CodeGateScreen
        funnelId={funnel.id}
        funnelTitle={funnel.title}
        creatorName={creatorProfile?.full_name}
        onSuccess={() => setCodeGateUnlocked(true)}
        onLoginClick={() => {}}
        isDark={isDark}
      />
    );
  }

  if (isPrivateFunnel && codeGateUnlocked && !privateLeadSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: tc.bg }}>
        <PrivateLeadForm
          funnelId={funnel.id}
          funnelTitle={funnel.title}
          requiredFields={requiredFields}
          onSuccess={() => setPrivateLeadSubmitted(true)}
          isDark={isDark}
        />
      </div>
    );
  }

  const ctaEnabled = funnel.cta_enabled === true;
  const hasLeadForm = formConfig?.capture_enabled;
  const showLeadFormNow = hasLeadForm && !leadSubmitted && formConfig.capture_timing === "before_video";
  const showLeadFormAfterCta = hasLeadForm && !leadSubmitted && formConfig.capture_timing === "after_cta" && showCta;
  const showLeadFormSidebar = hasLeadForm && !leadSubmitted && formConfig.capture_timing !== "before_video";
  const videoUrl = videoAsset?.public_url;
  const ctaTimingLeft = funnel.cta_timing_seconds ? Math.max(0, funnel.cta_timing_seconds - watchSeconds) : 0;
  const isVerified = creatorProfile?.kyc_status === "approved";

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied! Share it with your friends.");
  };

  const validateLead = (): Record<string, string | null> => {
    const e: Record<string, string | null> = {};
    if (formConfig?.show_name && (formConfig.name_required || leadForm.name)) e.name = formConfig.name_required ? validateRequired(leadForm.name, "Name") : null;
    if (formConfig?.show_phone && (formConfig.phone_required || leadForm.phone)) e.phone = (formConfig.phone_required || leadForm.phone) ? validatePhone(leadForm.phone) : null;
    if (formConfig?.show_email && (formConfig.email_required || leadForm.email)) e.email = (formConfig.email_required || leadForm.email) ? validateEmail(leadForm.email) : null;
    if (formConfig?.show_city && formConfig.city_required) e.city = validateRequired(leadForm.city, "City");
    if (formConfig?.show_custom && formConfig.custom_required) e.custom_value = validateRequired(leadForm.custom_value, formConfig.custom_field_label || "This field");
    return e;
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLead.isPending) return;
    const fe = validateLead();
    setLeadErrors(fe);
    if (Object.values(fe).some(Boolean)) {
      scrollToFirstError(fe, leadRefs.current, ["name", "phone", "email", "city", "custom_value"]);
      return;
    }
    submitLead.mutate();
  };

  const setLeadField = (k: keyof typeof leadForm, v: string) => {
    setLeadForm((p) => ({ ...p, [k]: v }));
    if (leadErrors[k]) setLeadErrors((p) => ({ ...p, [k]: null }));
  };

  const fieldErrEl = (k: string) =>
    leadErrors[k] ? <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{leadErrors[k]}</p> : null;
  const errBorder = (k: string) => (leadErrors[k] ? "#ef4444" : tc.inputBorder);

  const LeadFormCard = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
      <h3 className="text-lg font-heading font-bold mb-1" style={{ color: tc.text }}>{funnel.cta_text || "Register Now"}</h3>
      <p className="text-xs mb-5" style={{ color: tc.textMuted }}>Fill in your details to continue</p>
      <form onSubmit={handleLeadSubmit} className="space-y-3" noValidate>
        <input type="text" name="website" value={leadForm.website} onChange={(e) => setLeadForm({ ...leadForm, website: e.target.value })} style={{ position: "absolute", left: "-9999px" }} tabIndex={-1} autoComplete="off" />
        {formConfig?.show_name && (
          <div>
            <Input ref={(el) => { leadRefs.current.name = el; }} {...nameInputProps} placeholder="Full Name" value={leadForm.name} onChange={(e) => setLeadField("name", e.target.value)} onBlur={(e) => setLeadField("name", trimSmart(e.target.value))} aria-invalid={!!leadErrors.name} style={{ background: tc.inputBg, borderColor: errBorder("name"), color: tc.inputText }} className="h-12 rounded-xl" />
            {fieldErrEl("name")}
          </div>
        )}
        {formConfig?.show_phone && (
          <div>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-xl text-sm shrink-0 h-12" style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.textDim }}>+91</div>
              <Input ref={(el) => { leadRefs.current.phone = el; }} {...phoneInputProps} placeholder="9876543210" value={leadForm.phone} onChange={(e) => setLeadField("phone", normalizePhone(e.target.value))} aria-invalid={!!leadErrors.phone} style={{ background: tc.inputBg, borderColor: errBorder("phone"), color: tc.inputText }} className="h-12 rounded-xl" />
            </div>
            {fieldErrEl("phone")}
          </div>
        )}
        {formConfig?.show_email && (
          <div>
            <Input ref={(el) => { leadRefs.current.email = el; }} {...emailInputProps} placeholder="Email" value={leadForm.email} onChange={(e) => setLeadField("email", e.target.value)} onBlur={(e) => setLeadField("email", e.target.value.trim())} aria-invalid={!!leadErrors.email} style={{ background: tc.inputBg, borderColor: errBorder("email"), color: tc.inputText }} className="h-12 rounded-xl" />
            {fieldErrEl("email")}
          </div>
        )}
        {formConfig?.show_city && (
          <div>
            <Input ref={(el) => { leadRefs.current.city = el; }} {...cityInputProps} placeholder="City" value={leadForm.city} onChange={(e) => setLeadField("city", e.target.value)} onBlur={(e) => setLeadField("city", trimSmart(e.target.value))} aria-invalid={!!leadErrors.city} style={{ background: tc.inputBg, borderColor: errBorder("city"), color: tc.inputText }} className="h-12 rounded-xl" />
            {fieldErrEl("city")}
          </div>
        )}
        {formConfig?.show_custom && (
          <div>
            <Input ref={(el) => { leadRefs.current.custom_value = el; }} placeholder={formConfig.custom_field_label || "Additional Info"} value={leadForm.custom_value} onChange={(e) => setLeadField("custom_value", e.target.value)} aria-invalid={!!leadErrors.custom_value} style={{ background: tc.inputBg, borderColor: errBorder("custom_value"), color: tc.inputText }} className="h-12 rounded-xl" />
            {fieldErrEl("custom_value")}
          </div>
        )}
        <Button
          type="submit"
          className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
          disabled={submitLead.isPending}
        >
          {submitLead.isPending ? <><Loader2 size={16} className="animate-spin mr-2 inline" /> Submitting…</> : <>{funnel.cta_text || "Get Started"} →</>}
        </Button>
        <PrivacyMicrocopy color={tc.textMuted} />
      </form>
    </div>
  );

  return (
    <div
      className="flex flex-col"
      style={{
        background: tc.bg,
        minHeight: "100dvh",
        backgroundImage: isDark
          ? "radial-gradient(ellipse 800px 400px at 50% 200px, rgba(126, 232, 58, 0.06) 0%, transparent 70%)"
          : undefined,
      }}
    >
      <div
        className="flex items-center justify-between sticky top-0 z-50"
        style={{
          height: "52px",
          padding: "0 16px",
          borderBottom: `1px solid ${tc.borderSubtle}`,
          background: tc.headerBg,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-2">
          <a href="https://nevorai.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
            <img src={logoImg} alt="Nevorai" className="h-6 w-6" />
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, color: tc.text, letterSpacing: "-0.02em", fontSize: 16, lineHeight: 1 }}>Nevorai</span>
          </a>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePubTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: tc.shareText }}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={handleShare} className="p-2 rounded-lg transition-colors text-xs font-medium flex items-center gap-1.5" style={{ color: tc.shareText }}>
            <Share2 size={14} /> Share
          </button>
        </div>
      </div>

      {isMultiStep ? (
        <MultiStepViewer
          funnel={funnel}
          steps={funnelSteps}
          creatorProfile={creatorProfile}
          formConfig={formConfig}
          priceOptions={priceOptions}
          VideoPlayer={CustomVideoPlayer}
          isDark={isDark}
        />
      ) : (
      <div className="flex-1 flex flex-col max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="text-center mb-8">
          <h1
            className="font-heading font-extrabold tracking-tight leading-tight"
            style={{ fontSize: "clamp(20px, 3vw, 36px)", letterSpacing: "-0.02em", color: tc.text }}
          >
            {funnel.title}
          </h1>
          {funnel.description && <p style={{ fontSize: "15px", color: tc.textDim, lineHeight: "1.6" }} className="mt-3 max-w-xl mx-auto">{funnel.description}</p>}
        </div>
          <>
        {(leadSubmitted || privateLeadSubmitted) && (
          <div className="max-w-4xl mx-auto mb-4 flex justify-end">
            <Link
              to={`/f/${funnel.slug}/member`}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 transition"
            >
              👤 Member area
            </Link>
          </div>
        )}

        {showLeadFormNow && <LeadFormCard className="max-w-md mx-auto mb-8" />}

        {(!showLeadFormNow || leadSubmitted) && (
          <div className={`${showLeadFormSidebar && !leadSubmitted ? "lg:grid lg:grid-cols-[1fr_380px] lg:gap-8" : "max-w-4xl mx-auto"}`}>
            <div className="space-y-5">
              {videoUrl && (
                <CustomVideoPlayer
                  src={videoUrl}
                  poster={funnel.thumbnail_url || videoAsset?.thumbnail_url || undefined}
                  allowSeek={(videoAsset as any)?.allow_seek !== undefined ? (videoAsset as any).allow_seek !== false : funnel.allow_seek !== false}
                  allowSpeed={(videoAsset as any)?.allow_playback_speed !== undefined ? (videoAsset as any).allow_playback_speed !== false : funnel.allow_speed_change !== false}
                  autoplay={true}
                  onTimeUpdate={(ct, dur) => { setWatchSeconds(Math.floor(ct)); setVideoDuration(dur); }}
                  onPlay={() => setVideoPlaying(true)}
                />
              )}
              {videoUrl && videoAsset?.id && (videoAsset as any)?.allow_copy_link !== false && (
                <div className="flex justify-end">
                  <CopyNflowLinkButton videoId={videoAsset.id} />
                </div>
              )}
              {!videoUrl && (
                <div className="aspect-video rounded-2xl flex items-center justify-center" style={{ background: tc.bgCard, border: `1px solid ${tc.borderSubtle}` }}>
                  <Play size={48} style={{ color: tc.textDimmer }} />
                </div>
              )}

              {(() => {
                const speakerMode = funnel.speaker_mode || "account";
                const showSpeaker = speakerMode !== "none";
                if (!showSpeaker) return null;

                let speakerName = "";
                let speakerPhoto = "";
                let speakerAbout = "";
                if (speakerMode === "account") {
                  speakerName = creatorProfile?.full_name || "";
                  speakerPhoto = creatorProfile?.avatar_url || "";
                  speakerAbout = creatorProfile?.bio || "";
                } else {
                  speakerName = funnel.speaker_name || "";
                  speakerPhoto = funnel.speaker_photo_url || "";
                  speakerAbout = funnel.speaker_about || "";
                }

                if (!speakerName) return null;

                const whatsappNumber = funnel.contact_whatsapp;
                return (
                  <div
                    className="flex items-center gap-4 mt-4 p-4 sm:p-5 rounded-2xl flex-wrap nf-creator-card"
                    style={{
                      background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                    }}
                  >
                    <div className="relative shrink-0">
                      {speakerPhoto ? (
                        <img
                          src={speakerPhoto}
                          alt={speakerName}
                          className="w-[56px] h-[56px] sm:w-16 sm:h-16 rounded-full object-cover"
                          style={{ border: "2px solid hsl(var(--primary) / 0.4)" }}
                        />
                      ) : (
                        <div
                          className="w-[56px] h-[56px] sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-heading font-extrabold text-xl sm:text-2xl"
                          style={{
                            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(217 91% 60%))",
                            border: "2px solid hsl(var(--primary) / 0.3)",
                          }}
                        >
                          {speakerName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full nf-creator-dot"
                        style={{ background: "hsl(var(--primary))", border: `2px solid ${tc.bg}` }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[11px] font-medium uppercase mb-0.5"
                        style={{ letterSpacing: "1px", color: tc.textDimmer }}
                      >
                        Presented by
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="font-heading font-bold text-[16px] sm:text-[18px]" style={{ color: tc.text, letterSpacing: "0.3px" }}>{speakerName}</p>
                        {speakerMode === "account" && isVerified && <BadgeCheck size={16} className="text-primary flex-shrink-0" />}
                      </div>
                      {speakerAbout && (
                        <p className="text-[13px] mt-1 line-clamp-2" style={{ color: tc.textMuted }}>{speakerAbout}</p>
                      )}
                    </div>
                    {whatsappNumber && (
                      <a
                        href={`https://wa.me/${String(whatsappNumber).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[13px] transition-all w-full sm:w-auto"
                        style={{
                          background: "rgba(37, 211, 102, 0.1)",
                          border: "1px solid rgba(37, 211, 102, 0.25)",
                          color: "#25D366",
                        }}
                      >
                        <MessageCircle size={16} />
                        Chat on WhatsApp
                      </a>
                    )}
                  </div>
                );
              })()}

              {funnel.video_topics_enabled && Array.isArray(funnel.video_topics) && funnel.video_topics.filter((t: string) => t?.trim()).length > 0 && (
                <div className="rounded-2xl p-5" style={{ background: tc.bgCard, border: `1px solid ${tc.border}`, marginTop: "20px" }}>
                  <h3 className="font-heading font-bold text-[16px] mb-3.5" style={{ color: tc.text }}>What you'll learn in this session</h3>
                  <div className="space-y-0">
                    {funnel.video_topics.filter((t: string) => t?.trim()).map((topic: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 py-2"
                        style={{ borderBottom: idx < funnel.video_topics.filter((t: string) => t?.trim()).length - 1 ? `1px solid ${tc.border}` : "none" }}
                      >
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(34,197,94,0.12)" }}>
                          <Check size={11} className="text-emerald-500" />
                        </div>
                        <span className="text-[14px] leading-relaxed" style={{ color: tc.text }}>{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={showLeadFormSidebar && !leadSubmitted ? "lg:hidden" : ""}>
                {ctaEnabled && showCta && (
                  <Button
                    className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 cta-pulse"
                    onClick={() => funnel.cta_url ? window.open(funnel.cta_url, "_blank") : null}
                  >
                    {funnel.cta_text || "Get Started"} →
                  </Button>
                )}
                {ctaEnabled && funnel.lock_cta && !showCta && videoPlaying && (
                  <Button disabled className="w-full h-14 text-base rounded-xl cursor-not-allowed" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", color: tc.textDimmer, border: `1px solid ${tc.borderSubtle}` }}>
                    🔒 {funnel.cta_text || "Get Started"} — unlocks in {Math.floor(ctaTimingLeft / 60)}:{(ctaTimingLeft % 60).toString().padStart(2, "0")}
                  </Button>
                )}
              </div>

              {showLeadFormAfterCta && <div className="lg:hidden"><LeadFormCard /></div>}
            </div>

            {showLeadFormSidebar && !leadSubmitted && (
              <div className="hidden lg:block sticky top-6 self-start">
                <LeadFormCard />
                {ctaEnabled && showCta && funnel.cta_url && (
                  <Button
                    className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 mt-4 cta-pulse"
                    onClick={() => window.open(funnel.cta_url!, "_blank")}
                  >
                    {funnel.cta_text || "Get Started"} →
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {showLeadFormAfterCta && !showLeadFormSidebar && <LeadFormCard className="max-w-md mx-auto mt-6" />}

        {funnel.payment_enabled && leadSubmitted && !paymentSubmitted && (
          <div className="rounded-2xl p-6 max-w-md mx-auto mt-6" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
            <h3 className="text-lg font-heading font-semibold mb-4" style={{ color: tc.text }}>Complete Payment</h3>
            {priceOptions.length > 0 && (
              <div className="space-y-2 mb-4">
                {priceOptions.map((opt: any) => (
                  <button key={opt.id} onClick={() => setPaymentProof({ ...paymentProof, amount: opt.amount })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${paymentProof.amount === opt.amount ? "border-primary bg-primary/10" : ""}`}
                    style={paymentProof.amount !== opt.amount ? { borderColor: tc.border, background: tc.inputBg } : {}}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: tc.text }}>{opt.label}</span>
                      <span className="font-heading font-bold" style={{ color: tc.text }}>₹{opt.amount.toLocaleString("en-IN")}</span>
                    </div>
                    {opt.description && <p className="text-xs mt-1" style={{ color: tc.textMuted }}>{opt.description}</p>}
                  </button>
                ))}
              </div>
            )}
            {funnel.upi_id && (
              <div className="p-3 rounded-xl mb-4" style={{ background: tc.inputBg }}>
                <Label className="text-xs" style={{ color: tc.textMuted }}>Pay via UPI</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm text-primary flex-1">{funnel.upi_id}</code>
                  <Button variant="ghost" size="sm" style={{ color: tc.textMuted }} onClick={() => { navigator.clipboard.writeText(funnel.upi_id!); toast.success("UPI ID copied!"); }}>Copy</Button>
                </div>
              </div>
            )}
            {funnel.qr_code_url && <img src={funnel.qr_code_url} alt="QR Code" className="w-48 h-48 mx-auto mb-4 rounded-xl" />}
            {funnel.payment_instructions && <p className="text-sm mb-4" style={{ color: tc.textMuted }}>{funnel.payment_instructions}</p>}
            <div className="space-y-3">
              <Input placeholder="UPI Transaction ID (optional)" value={paymentProof.upi_transaction_id} onChange={(e) => setPaymentProof({ ...paymentProof, upi_transaction_id: e.target.value })} style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }} className="h-12 rounded-xl" />
              <Button className="w-full h-14 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" onClick={() => submitPayment.mutate()} disabled={submitPayment.isPending}>
                {submitPayment.isPending ? "Submitting..." : "I've Made the Payment"}
              </Button>
            </div>
          </div>
        )}

        {paymentSubmitted && (
          <div className="rounded-2xl p-6 text-center max-w-md mx-auto mt-6" style={{ background: tc.bgCard, border: `1px solid ${tc.border}` }}>
            <Check size={32} className="text-green-500 mx-auto mb-3" />
            <h3 className="font-heading font-semibold" style={{ color: tc.text }}>Payment Under Review</h3>
            <p className="text-sm mt-1" style={{ color: tc.textMuted }}>Your payment proof has been submitted. You'll be notified once it's verified.</p>
          </div>
        )}
        </>

        {funnel.show_contact_buttons && (leadSubmitted || !funnel.show_contact_after_cta) && (
          <div className="fixed bottom-0 left-0 right-0 p-4 backdrop-blur-xl flex gap-3 justify-center z-50" style={{ background: tc.contactBg, borderTop: `1px solid ${tc.borderSubtle}` }}>
            {funnel.contact_whatsapp && (
              <Button className="bg-[#25d366] hover:bg-[#20b858] text-white" onClick={() => window.open(`https://wa.me/${funnel.contact_whatsapp?.replace(/\D/g, "")}`)}>
                <MessageCircle size={16} /> WhatsApp
              </Button>
            )}
            {funnel.contact_phone && (
              <Button style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: tc.text, border: `1px solid ${tc.borderSubtle}` }} onClick={() => window.open(`tel:${funnel.contact_phone}`)}>
                <PhoneIcon size={16} /> Call
              </Button>
            )}
          </div>
        )}

        <div className="flex-1" />

        <footer style={{ textAlign: "center", padding: "24px 16px", color: "#9ca3af", fontSize: 13, borderTop: `1px solid ${tc.footerBorder}`, marginTop: 64 }}>
          © 2026 Nevorai · All Rights Reserved · India
        </footer>
      </div>
      )}

      <style>{`
        .cta-pulse { animation: ctaPulse 2s ease-in-out infinite; }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
          50% { box-shadow: 0 0 0 8px hsl(var(--primary) / 0); }
        }
        .nf-creator-card { transition: border-color 0.2s ease; }
        .nf-creator-card:hover { border-color: hsl(var(--primary) / 0.3) !important; }
        .nf-creator-dot { animation: nfCreatorDot 2s ease-in-out infinite; }
        @keyframes nfCreatorDot {
          0%, 100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5); }
          50%      { box-shadow: 0 0 0 6px hsl(var(--primary) / 0); }
        }
      `}</style>
      
    </div>
  );
};

export default PublicFunnel;
