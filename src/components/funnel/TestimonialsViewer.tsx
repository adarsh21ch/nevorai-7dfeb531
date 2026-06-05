import { useState, useRef, useEffect } from "react";
import { Star, Volume2, VolumeX, Play, Pause } from "lucide-react";

interface Testimonial {
  id: string;
  type: string;
  student_name: string;
  student_location?: string;
  student_photo_url?: string;
  review_text?: string;
  video_url?: string;
  thumbnail_url?: string;
  video_duration_seconds?: number;
}

interface TestimonialsViewerProps {
  testimonials: Testimonial[];
  sectionTitle: string;
}

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const formatDuration = (sec?: number) => {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

export const TestimonialsViewer = ({ testimonials, sectionTitle }: TestimonialsViewerProps) => {
  const activeItems = testimonials.filter((t) => {
    if (t.type === "both") return Boolean(t.review_text?.trim()) || Boolean(t.video_url);
    if (t.type === "video") return Boolean(t.video_url);
    return Boolean(t.review_text?.trim());
  });

  if (activeItems.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-[22px] font-semibold text-center">{sectionTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {activeItems.map((t) => (
          <TCard key={t.id} testimonial={t} />
        ))}
      </div>
    </div>
  );
};

const TCard = ({ testimonial: t }: { testimonial: Testimonial }) => {
  const [expandedText, setExpandedText] = useState(false);
  const showText = t.type === "text" || t.type === "both";
  const showVideo = t.type === "video" || t.type === "both";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-4 pb-3">
        {t.student_photo_url ? (
          <img src={t.student_photo_url} alt={t.student_name} width={44} height={44} loading="lazy" decoding="async" className="w-11 h-11 rounded-full object-cover border-2 border-background shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
            {initials(t.student_name || "?")}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{t.student_name}</p>
          {t.student_location && <p className="text-xs text-muted-foreground truncate">{t.student_location}</p>}
        </div>
      </div>

      <div className="px-4 pb-2 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className="fill-amber-400 text-amber-400" />)}
      </div>

      {showText && t.review_text?.trim() && (
        <div className="px-4 pb-3">
          <TextContent text={t.review_text} expanded={expandedText} onToggle={() => setExpandedText(!expandedText)} />
        </div>
      )}

      {showVideo && t.video_url && (
        <div className="px-3 pb-3">
          <VideoPlayer videoUrl={t.video_url} thumbnailUrl={t.thumbnail_url} durationSeconds={t.video_duration_seconds} />
        </div>
      )}
    </div>
  );
};

const TextContent = ({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) => {
  const isLong = text.length > 140;
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {isLong && !expanded ? text.slice(0, 140) + "..." : text}
      {isLong && (
        <button className="text-primary text-xs ml-1 hover:underline" onClick={onToggle}>
          {expanded ? "show less" : "read more"}
        </button>
      )}
    </p>
  );
};

const VideoPlayer = ({ videoUrl, thumbnailUrl, durationSeconds }: { videoUrl: string; thumbnailUrl?: string; durationSeconds?: number }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { if (v.duration) setProgress((v.currentTime / v.duration) * 100); };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else {
      if (!hasStarted) setHasStarted(true);
      v.play().then(() => setPlaying(true)).catch(() => {
        v.muted = true; setMuted(true);
        v.play().then(() => setPlaying(true)).catch(() => {});
      });
    }
  };

  const handleEnded = () => { setPlaying(false); setProgress(0); };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted); }
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-black cursor-pointer aspect-[9/16] max-h-[420px]" onClick={handlePlayPause}>
      <video ref={videoRef} src={videoUrl} poster={thumbnailUrl || undefined} muted={muted} playsInline preload="metadata" className="w-full h-full object-cover" onEnded={handleEnded} onError={() => setLoadError(true)} />

      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-black/80 px-3 gap-1">
          <div className="text-destructive text-xs font-medium">⚠️ Video format not supported.</div>
          <div className="text-white/70 text-[11px]">Please re-upload as MP4 format.</div>
        </div>
      )}

      {!playing && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Play size={22} className="text-black ml-0.5" />
          </div>
        </div>
      )}

      {!hasStarted && durationSeconds && durationSeconds > 0 && (
        <span className="absolute top-2 right-2 text-[11px] text-white bg-black/60 px-2 py-0.5 rounded-full">
          {formatDuration(durationSeconds)}
        </span>
      )}

      {hasStarted && (
        <>
          <button className="absolute top-2 left-2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white" onClick={toggleMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          {!playing && (
            <button className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white" onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}>
              <Pause size={15} />
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-10">
            <div className="h-full bg-white transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </div>
  );
};
