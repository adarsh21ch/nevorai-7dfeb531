import { supabase } from "@/integrations/supabase/client";
import { sanitizeFilename, hasDoubleExtension } from "@/lib/sanitize";

type UploadPurpose = "video-asset" | "academy-video" | "academy-thumbnail";

interface UploadVideoToR2Options {
  file: File;
  title?: string;
  timeoutMs?: number;
  onProgress?: (
    percent: number,
    meta?: { loaded: number; total: number }
  ) => void;
}

interface UploadVideoToR2Result {
  publicUrl: string;
  videoId: string;
}

interface UploadFileToR2Options {
  file: File;
  purpose: UploadPurpose;
  title?: string;
  timeoutMs?: number;
  onProgress?: (
    percent: number,
    meta?: { loaded: number; total: number }
  ) => void;
}

interface UploadFileToR2Result {
  publicUrl: string;
  r2Key?: string;
  videoId?: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Upload failed";
};

const resolveContentType = (file: File): string => {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
};

export const uploadVideoToR2 = async ({
  file,
  title,
  timeoutMs = 30 * 60 * 1000,
  onProgress,
}: UploadVideoToR2Options): Promise<UploadVideoToR2Result> => {
  const result = await uploadFileToR2({
    file,
    title,
    timeoutMs,
    onProgress,
    purpose: "video-asset",
  });

  if (!result.videoId) {
    throw new Error("Upload finished but video record was not created");
  }

  return {
    publicUrl: result.publicUrl,
    videoId: result.videoId,
  };
};

export const uploadFileToR2 = async ({
  file,
  purpose,
  title,
  timeoutMs = 30 * 60 * 1000,
  onProgress,
}: UploadFileToR2Options): Promise<UploadFileToR2Result> => {
  let videoId: string | null = null;

  try {
    // Block double-extension tricks like video.mp4.exe
    if (hasDoubleExtension(file.name)) {
      throw new Error("This filename looks unsafe — please rename and try again.");
    }
    const safeName = sanitizeFilename(file.name);
    const contentType = resolveContentType(file);

    const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
      body: {
        filename: safeName,
        contentType,
        title: title || safeName,
        fileSize: file.size,
        purpose,
      },
    });

    if (error || !data?.uploadUrl) {
      throw new Error(data?.error || error?.message || "Failed to start upload");
    }

    videoId = data.videoId || null;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", data.uploadUrl);
      xhr.timeout = timeoutMs;
      xhr.setRequestHeader("Content-Type", contentType);

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress?.(percent, { loaded: event.loaded, total: event.total });
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100, { loaded: file.size, total: file.size });
          resolve();
          return;
        }

        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      };

      xhr.onerror = () => reject(new Error("Network error while uploading video"));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or a faster connection."));
      xhr.send(file);
    });

    if (data.confirmRequired === false) {
      if (!data.publicUrl) {
        throw new Error("Upload finished but no public URL was returned");
      }

      return {
        publicUrl: data.publicUrl,
        r2Key: data.r2Key,
      };
    }

    const { data: confirmData, error: confirmError } = await supabase.functions.invoke("confirm-r2-upload", {
      body: {
        videoId,
        fileSizeBytes: file.size,
      },
    });

    if (confirmError || !confirmData?.publicUrl) {
      throw new Error(confirmData?.error || confirmError?.message || "Upload finished but confirmation failed");
    }

    return {
      videoId: videoId || undefined,
      publicUrl: confirmData.publicUrl,
      r2Key: data.r2Key,
    };
  } catch (error) {
    if (videoId && purpose === "video-asset") {
      try {
        await supabase.functions.invoke("confirm-r2-upload", {
          body: {
            videoId,
            failed: true,
            errorMessage: getErrorMessage(error),
          },
        });
      } catch {
        // best effort cleanup
      }
    }

    throw error;
  }
};
