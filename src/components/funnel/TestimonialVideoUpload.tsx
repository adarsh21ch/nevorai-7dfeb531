import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";

interface TestimonialVideoUploadProps {
  testimonialId: string;
  landingPageId: string;
  value: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  maxSeconds: number;
  onUploaded: (payload: { videoUrl: string; thumbnailUrl: string | null; durationSeconds: number }) => void;
  onClear: () => void;
}

const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_SIZE_MB = 100;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const formatDuration = (seconds?: number | null) => {
  if (!seconds && seconds !== 0) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const getVideoMetadata = (file: File): Promise<{ duration: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { resolve({ duration: Math.round(video.duration) }); URL.revokeObjectURL(objectUrl); };
    video.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read the video metadata. Please use MP4, MOV, or WEBM.")); };
    video.src = objectUrl;
  });

const generateVideoThumbnail = (file: File): Promise<Blob | null> =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let cleaned = false;
    const cleanup = () => { if (cleaned) return; cleaned = true; URL.revokeObjectURL(objectUrl); };
    const captureFrame = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxHeight = 960;
        const scale = video.videoHeight ? Math.min(1, maxHeight / video.videoHeight) : 1;
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { cleanup(); resolve(blob ?? null); }, "image/jpeg", 0.82);
      } catch { cleanup(); resolve(null); }
    };
    video.preload = "metadata"; video.muted = true; video.playsInline = true;
    video.onloadedmetadata = () => {
      const targetTime = Math.min(Math.max(video.duration * 0.15, 0.1), Math.max(video.duration - 0.1, 0.1));
      if (Number.isFinite(targetTime) && targetTime > 0.1) { video.currentTime = targetTime; return; }
      captureFrame();
    };
    video.onseeked = captureFrame;
    video.onerror = () => { cleanup(); resolve(null); };
    video.src = objectUrl;
  });

export const TestimonialVideoUpload = ({
  testimonialId, landingPageId, value, thumbnailUrl, durationSeconds, maxSeconds, onUploaded, onClear,
}: TestimonialVideoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [statusLabel, setStatusLabel] = useState("Preparing upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) { setError("Only MP4, MOV, and WEBM videos are supported."); return; }
    if (file.size > MAX_SIZE_BYTES) { setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`); return; }

    setUploading(true); setFileName(file.name); setProgress(0); setStatusLabel("Checking video");
    try {
      const { duration } = await getVideoMetadata(file);
      if (duration > maxSeconds) throw new Error(`Your video is ${duration} seconds. Max allowed is ${maxSeconds} seconds.`);

      setProgress(10); setStatusLabel("Creating preview cover");
      let uploadedThumbnailUrl: string | null = null;
      const thumbnailBlob = await generateVideoThumbnail(file);
      if (thumbnailBlob) {
        try {
          const thumbnailPath = `testimonial-thumbnails/${landingPageId}/${testimonialId}-${Date.now()}.jpg`;
          const { error: thumbErr } = await supabase.storage.from("landing-page-assets")
            .upload(thumbnailPath, thumbnailBlob, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });
          if (!thumbErr) {
            const { data: { publicUrl } } = supabase.storage.from("landing-page-assets").getPublicUrl(thumbnailPath);
            uploadedThumbnailUrl = publicUrl;
          }
        } catch { uploadedThumbnailUrl = null; }
      }

      setProgress(20); setStatusLabel("Uploading video");
      const videoPath = `testimonial-videos/${landingPageId}/${testimonialId}-${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'mp4'}`;
      const { error: uploadError } = await supabase.storage.from("landing-page-assets")
        .upload(videoPath, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message || "Video upload failed");

      setProgress(90); setStatusLabel("Finalizing");
      const { data: { publicUrl } } = supabase.storage.from("landing-page-assets").getPublicUrl(videoPath);

      setProgress(100); setStatusLabel("Upload complete");
      onUploaded({ videoUrl: publicUrl!, thumbnailUrl: uploadedThumbnailUrl, durationSeconds: duration });
      toast.success("Video uploaded successfully");
    } catch (err) {
      setProgress(0); setStatusLabel("Upload failed");
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const durationLabel = formatDuration(durationSeconds);

  return (
    <div
      className={`rounded-2xl border p-4 ${error ? "border-destructive bg-destructive/5" : "border-border bg-card/50"}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
    >
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />

      {value ? (
        <div className="space-y-3">
          <div className="max-w-[220px] rounded-[1.5rem] border border-border bg-background/70 p-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[1rem] bg-foreground/10">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Student testimonial preview" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <video src={value} className="absolute inset-0 h-full w-full object-cover" preload="metadata" muted playsInline />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-sm">
                  <Play size={18} className="text-foreground" />
                </div>
              </div>
              {durationLabel && (
                <span className="absolute right-3 top-3 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
                  {durationLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => inputRef.current?.click()}>
              <Upload size={13} className="mr-1.5" /> Replace video
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={onClear}>
              <X size={13} className="mr-1.5" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="mx-auto w-[132px] shrink-0 sm:mx-0">
            <div className={`flex aspect-[9/16] items-center justify-center rounded-[1.25rem] border ${error ? "border-destructive/50" : "border-border border-dashed"} bg-muted/35 p-4 text-center`}>
              <div className="space-y-2">
                {uploading ? <Loader2 size={24} className="mx-auto animate-spin text-primary" /> : <Video size={24} className="mx-auto text-primary" />}
                <div>
                  <p className="text-xs font-medium text-foreground">Vertical preview</p>
                  <p className="text-[10px] text-muted-foreground">Reel-style card</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div>
              <p className="text-sm font-medium text-foreground">{uploading ? "Uploading student video" : "Upload a student video testimonial"}</p>
              <p className="text-xs text-muted-foreground">MP4, MOV, WEBM • Max {maxSeconds} seconds • Max {MAX_SIZE_MB}MB</p>
              <p className="text-xs text-muted-foreground">Portrait videos look best in the live preview.</p>
            </div>
            {uploading ? (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p className="truncate">{fileName}</p>
                  <p>{statusLabel} • {progress}%</p>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => inputRef.current?.click()}>
                <Upload size={13} className="mr-1.5" /> Choose video
              </Button>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
