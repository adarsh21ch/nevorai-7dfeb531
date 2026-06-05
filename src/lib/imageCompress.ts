/**
 * Client-side image compression to WebP. Used by every Supabase Storage
 * image upload site to (a) shrink files before they hit the wire and
 * (b) ensure they round-trip with a long Cache-Control so we stop
 * burning egress on repeat downloads.
 *
 * Uses OffscreenCanvas where available, falls back to HTMLCanvasElement
 * for Safari < 16.4 and other environments where OffscreenCanvas.toBlob
 * is missing.
 */

export interface CompressPreset {
  maxDim: number;
  quality: number;
  /** Output MIME type. Defaults to image/webp. */
  type?: string;
}

export const IMAGE_PRESETS = {
  /** Profile photos, speaker headshots — small round thumbnails. */
  AVATAR: { maxDim: 256, quality: 0.85 } as CompressPreset,
  /** Testimonial student photos — small but a bit larger than avatars. */
  TESTIMONIAL_PHOTO: { maxDim: 400, quality: 0.85 } as CompressPreset,
  /** Landing page imagery (hero, sections). Larger but not full-res. */
  LANDING_IMAGE: { maxDim: 1200, quality: 0.85 } as CompressPreset,
} as const;

/** Long-lived cache header for Supabase Storage uploads (1 year). */
export const LONG_CACHE_CONTROL = "31536000";

const isImageType = (type: string) => type.startsWith("image/");

async function loadBitmap(source: Blob | File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}> {
  // Prefer createImageBitmap — fast and off-thread capable.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap as any, 0, 0, w, h),
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // fall through to HTMLImageElement
    }
  }
  // Fallback: HTMLImageElement via object URL.
  const url = URL.createObjectURL(source);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not decode image"));
    i.src = url;
  });
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    cleanup: () => URL.revokeObjectURL(url),
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    if (typeof (canvas as any).convertToBlob === "function") {
      return (canvas as any).convertToBlob({ type, quality });
    }
    // Older Safari: no convertToBlob — re-draw to HTMLCanvasElement.
    const html = document.createElement("canvas");
    html.width = canvas.width;
    html.height = canvas.height;
    const ctx = html.getContext("2d")!;
    ctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
    return canvasToBlob(html, type, quality);
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null"))),
      type,
      quality,
    );
  });
}

/**
 * Compress an image Blob/File to WebP (or specified type), capped at
 * preset.maxDim on its longest edge. If anything fails (decode error,
 * unsupported codec), returns the original blob unchanged so the upload
 * still succeeds.
 */
export async function compressImage(
  input: Blob | File,
  preset: CompressPreset,
): Promise<Blob> {
  const type = preset.type ?? "image/webp";
  // Already small WebP? Skip.
  if (
    input.type === type &&
    "size" in input &&
    input.size < 25 * 1024
  ) {
    return input;
  }
  if (!isImageType(input.type) && !(input as File).name?.match(/\.(png|jpe?g|webp|gif|bmp)$/i)) {
    // Not an image — return as-is.
    return input;
  }

  try {
    const bmp = await loadBitmap(input);
    const longest = Math.max(bmp.width, bmp.height);
    const scale = longest > preset.maxDim ? preset.maxDim / longest : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(w, h);
    } else {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      canvas = c;
    }
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) {
      bmp.cleanup();
      return input;
    }
    bmp.draw(ctx, w, h);
    bmp.cleanup();
    const blob = await canvasToBlob(canvas, type, preset.quality);
    // If WebP somehow came out larger than the original, keep the original.
    if (blob.size >= input.size) return input;
    return blob;
  } catch {
    return input;
  }
}

/**
 * Convenience: returns a path with a `.webp` extension swapped in.
 * Use when uploading a compressed WebP so the URL filename matches.
 */
export function withWebpExtension(path: string): string {
  return path.replace(/\.[a-z0-9]+$/i, "") + ".webp";
}
