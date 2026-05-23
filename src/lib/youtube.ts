/**
 * YouTube link helpers.
 * Pure client-side; oEmbed is CORS-enabled by Google.
 */

export const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export const extractYouTubeId = (input: string): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  // Raw 11-char id
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(YT_ID_RE);
  return m ? m[1] : null;
};

export const isYouTubeUrl = (url?: string | null): boolean => {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(url) && !!extractYouTubeId(url);
};

export const buildYouTubeWatchUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

export const buildYouTubeEmbedUrl = (
  videoId: string,
  opts: { autoplay?: boolean; start?: number } = {}
) => {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    fs: "1",
    playsinline: "1",
    cc_load_policy: "0",
    color: "white",
    disablekb: "0",
  });
  if (opts.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }
  if (opts.start && opts.start > 0) params.set("start", String(Math.floor(opts.start)));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

export interface YouTubeMeta {
  title: string;
  thumbnailUrl: string;
  authorName: string | null;
}

export const fetchYouTubeMeta = async (videoId: string): Promise<YouTubeMeta | null> => {
  try {
    const watchUrl = buildYouTubeWatchUrl(videoId);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
    return {
      title: data.title || "YouTube video",
      // Prefer the higher-res maxresdefault when available.
      thumbnailUrl:
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` ||
        data.thumbnail_url ||
        "",
      authorName: data.author_name || null,
    };
  } catch {
    return null;
  }
};
