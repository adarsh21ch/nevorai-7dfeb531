import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Play, Pause, Maximize } from "lucide-react";

interface PostSubmitVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
}

export const PostSubmitVideoPlayer = ({ videoUrl, thumbnailUrl }: PostSubmitVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [videoUrl]);

  useEffect(() => {
    if (!showUnmuteHint) return;
    const t = setTimeout(() => setShowUnmuteHint(false), 5000);
    return () => clearTimeout(t);
  }, [showUnmuteHint]);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) scheduleHide();
    else setShowControls(true);
  }, [isPlaying, scheduleHide]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      if (v.duration) { setDuration(v.duration); setProgress((v.currentTime / v.duration) * 100); }
    };
    const onMeta = () => setDuration(v.duration);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {});
    else { v.pause(); setIsPlaying(false); }
    scheduleHide();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
    if (!v.muted) setShowUnmuteHint(false);
    scheduleHide();
  };

  const seekToPosition = useCallback((clientX: number) => {
    const v = videoRef.current;
    const bar = seekBarRef.current;
    if (!v || !bar || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const handleSeekDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsSeeking(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    seekToPosition(clientX);
  };

  useEffect(() => {
    if (!isSeeking) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      seekToPosition(clientX);
    };
    const onUp = () => setIsSeeking(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isSeeking, seekToPosition]);

  const enterFullscreen = async (videoEl: HTMLVideoElement) => {
    try {
      if ((videoEl as any).webkitEnterFullscreen) { (videoEl as any).webkitEnterFullscreen(); return; }
      if (videoEl.requestFullscreen) { await videoEl.requestFullscreen(); return; }
      if ((videoEl as any).webkitRequestFullscreen) { await (videoEl as any).webkitRequestFullscreen(); }
    } catch (err) { console.error("Fullscreen error:", err); }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const isFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      enterFullscreen(v);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div ref={containerRef} className="relative aspect-video rounded-xl overflow-hidden bg-black cursor-pointer group" onClick={togglePlay} onMouseMove={scheduleHide}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={thumbnailUrl || undefined}
        muted
        playsInline
        {...({ "webkit-playsinline": "" } as any)}
        preload="auto"
        className="w-full h-full object-contain"
        onEnded={() => { setIsPlaying(false); setProgress(100); }}
      />

      {showUnmuteHint && isMuted && isPlaying && (
        <button
          onClick={toggleMute}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-medium animate-in fade-in slide-in-from-left-2 duration-300 hover:bg-black/90 transition-colors"
        >
          <VolumeX size={14} />
          Tap to unmute
        </button>
      )}

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
          <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-xl transition-transform hover:scale-110">
            <Play size={26} className="text-black ml-1" />
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={seekBarRef}
          className="relative h-4 flex items-center cursor-pointer touch-none select-none mx-2 mb-1"
          onMouseDown={handleSeekDown}
          onTouchStart={handleSeekDown}
        >
          <div className="h-1 bg-white/20 rounded-full w-full relative">
            <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md transition-opacity ${isSeeking ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-100"}`}
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-white/80">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-white/80">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <span className="text-[11px] text-white/70 font-mono">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-white/80"
            style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "all" }}
            aria-label="Toggle fullscreen"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10 transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
};
