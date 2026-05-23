import { extractYouTubeId, buildYouTubeEmbedUrl } from "@/lib/youtube";

interface YouTubeEmbedProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  initialTime?: number;
  title?: string;
}

/**
 * Privacy-enhanced YouTube embed. Hardened against showing related,
 * end-screen, or annotation suggestions so viewers stay on our flow.
 *
 * Renders to fill its parent — wrap in an aspect-video container.
 */
export const YouTubeEmbed = ({
  src,
  autoplay = false,
  initialTime,
  title,
}: YouTubeEmbedProps) => {
  const videoId = extractYouTubeId(src);
  if (!videoId) return null;
  const embedUrl = buildYouTubeEmbedUrl(videoId, { autoplay, start: initialTime });
  return (
    <iframe
      src={embedUrl}
      title={title || "YouTube video player"}
      className="absolute inset-0 w-full h-full border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
    />
  );
};

export default YouTubeEmbed;
