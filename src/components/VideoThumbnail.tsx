import { Video } from "lucide-react";

interface VideoThumbnailProps {
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  title?: string;
  className?: string;
  /** When false, omit the aspect-video wrapper class so callers can size freely. */
  enforceAspect?: boolean;
}

/**
 * Renders a video preview with three-tier fallback:
 *   1. uploaded thumbnail image
 *   2. first-frame poster from the video itself (#t=0.5)
 *   3. neutral placeholder icon
 *
 * The wrapper enforces aspect-video by default to avoid layout shift.
 */
export const VideoThumbnail = ({
  thumbnailUrl,
  videoUrl,
  title = "Video",
  className = "",
  enforceAspect = true,
}: VideoThumbnailProps) => {
  const base = `relative overflow-hidden rounded-lg bg-muted ${enforceAspect ? "aspect-video" : ""} ${className}`;

  if (thumbnailUrl) {
    return (
      <div className={base}>
        <img
          src={thumbnailUrl}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback chain for YouTube thumbnails: hq → mq → default
            const img = e.currentTarget;
            const src = img.src;
            const ytMatch = src.match(/\/vi\/([A-Za-z0-9_-]{11})\/(\w+)\.jpg/);
            if (!ytMatch) return;
            const [, id, variant] = ytMatch;
            const order = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"];
            const idx = order.indexOf(variant);
            const next = order[idx + 1];
            if (next) img.src = `https://i.ytimg.com/vi/${id}/${next}.jpg`;
          }}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }


  if (videoUrl) {
    return (
      <div className={base}>
        <video
          src={`${videoUrl}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-center`}>
      <Video className="text-muted-foreground" size={24} />
    </div>
  );
};

export default VideoThumbnail;
