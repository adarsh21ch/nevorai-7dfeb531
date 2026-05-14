/**
 * Capture the first frame of a video file as a small JPEG data URL,
 * suitable for storing in `video_assets.thumbnail_url` directly.
 *
 * Returns null on any browser/codec error.
 */
export async function captureFirstFrameDataUrl(
  file: File,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<string | null> {
  const blob = await captureFirstFrame(file, opts);
  if (!blob) return null;
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Capture the first frame of a video file as a JPEG blob.
 * Returns null on any error (browser quirks, codec issues, etc.).
 */
export async function captureFirstFrame(
  file: File,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<Blob | null> {
  const { maxWidth = 480, quality = 0.78 } = opts;
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const scale = Math.min(1, maxWidth / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return resolve(null);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          quality,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}
