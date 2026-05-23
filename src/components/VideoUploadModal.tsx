import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { uploadVideoToR2 } from "@/lib/r2VideoUpload";
import { captureFirstFrameDataUrl } from "@/lib/videoThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileVideo, Loader2, Info, AlertCircle, RotateCcw, ChevronDown, AlertTriangle, Copy, ExternalLink, CheckCircle2, Layers, FileText, Radio } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { sanitizeText, sanitizeFilename } from "@/lib/sanitize";
import { Link } from "@/lib/router-compat";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";
import { useStorageUsage } from "@/hooks/useStorageUsage";
import { StorageLimitModal } from "@/components/StorageLimitModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (videoId?: string) => void;
  skipStorageCheck?: boolean;
  initialFile?: File | null;
}

// MP4 = best path. MOV/WEBM = supported but soft-warned. M4V/MKV/AVI =
// best-effort: we accept and warn, instead of rejecting a file the user
// just spent a minute picking.
const PREFERRED_EXTENSIONS = [".mp4"];
const SUPPORTED_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v"];
const LENIENT_EXTENSIONS = [".mkv", ".avi"];
const SUPPORTED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-msvideo",
];
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

type AcceptResult = "ok" | "warn" | "reject";

const checkVideoAcceptance = (file: File): AcceptResult => {
  const name = file.name.toLowerCase();
  if (PREFERRED_EXTENSIONS.some((ext) => name.endsWith(ext)) || file.type === "video/mp4") {
    return "ok";
  }
  if (SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return "warn";
  if (LENIENT_EXTENSIONS.some((ext) => name.endsWith(ext))) return "warn";
  if (file.type && file.type.startsWith("video/")) return "warn";
  if (SUPPORTED_MIME_TYPES.includes(file.type)) return "warn";
  return "reject";
};

const formatEta = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min remaining`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return `${h}h ${m}m remaining`;
};

const FORMAT_WARNING_MSG =
  "We'll try to upload this format, but MP4 plays the smoothest on every device. If playback stutters, convert to MP4 at cloudconvert.com.";
const FORMAT_REJECT_MSG =
  "That doesn't look like a video file. Please pick an MP4, MOV, WEBM, M4V, MKV, or AVI — or convert it first at cloudconvert.com.";

export const VideoUploadModal = ({ open, onClose, onSuccess, skipStorageCheck = false, initialFile = null }: Props) => {
  const autoPickRef = useRef(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatWarning, setFormatWarning] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nevorai.uploadTipDismissed") === "1";
  });
  const dismissTip = () => {
    try { localStorage.setItem("nevorai.uploadTipDismissed", "1"); } catch {}
    setTipDismissed(true);
    setTipOpen(false);
  };
  // "Allow others to reuse" lives in Edit Details now. New uploads start OFF;
  // creators can flip it on per-video from the details modal.
  const allowCopyLink = false;
  const [doneVideoId, setDoneVideoId] = useState<string | null>(null);
  const [storageLimitOpen, setStorageLimitOpen] = useState(false);
  const storage = useStorageUsage();

  // Hydrate from initialFile when modal opens with a preselected file
  useEffect(() => {
    if (open && initialFile && !file) {
      setFile(initialFile);
      if (!title) setTitle(initialFile.name.replace(/\.[^/.]+$/, ""));
    }
  }, [open, initialFile]);

  // Fallback: if modal opens without a file, trigger native picker once
  useEffect(() => {
    if (open && !file && !initialFile && !doneVideoId && !autoPickRef.current) {
      autoPickRef.current = true;
      setTimeout(() => fileRef.current?.click(), 80);
    }
    if (!open) autoPickRef.current = false;
  }, [open, file, initialFile, doneVideoId]);

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setProgress(0);
    setUploading(false);
    setProcessing(false);
    setEta("");
    setError(null);
    setFormatWarning(null);
    // allowCopyLink is now a constant — nothing to reset
    setDoneVideoId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);

    const result = checkVideoAcceptance(f);

    if (result === "reject") {
      toast.error(FORMAT_REJECT_MSG, { duration: 7000 });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (f.size > MAX_SIZE_BYTES) {
      const sizeMb = Math.round(f.size / (1024 * 1024));
      toast.error(
        `That file is ${sizeMb} MB — uploads are capped at 500 MB. Compress it (e.g. handbrake.fr) and try again.`,
        { duration: 7000 },
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // Storage quota gate — block before any upload starts.
    if (!skipStorageCheck && !storage.isLoading && storage.wouldExceed(f.size)) {
      setStorageLimitOpen(true);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setFormatWarning(result === "warn" ? FORMAT_WARNING_MSG : null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const runUpload = async () => {
    const cleanTitle = sanitizeText(title);
    const cleanDescription = sanitizeText(description);
    if (!user || !file || !cleanTitle) return;
    setUploading(true);
    setProcessing(false);
    setProgress(0);
    setEta("");
    setError(null);
    startTimeRef.current = Date.now();

    try {
      const result = await uploadVideoToR2({
        file,
        title: cleanTitle,
        onProgress: (percent: number, meta?: { loaded: number; total: number }) => {
          setProgress(percent);
          if (meta && meta.loaded > 0) {
            const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
            if (elapsedSec > 0.5) {
              const speed = meta.loaded / elapsedSec;
              const remainingBytes = meta.total - meta.loaded;
              const remainingSec = remainingBytes / Math.max(speed, 1);
              setEta(formatEta(remainingSec));
            }
          }
          if (percent >= 100) {
            setEta("");
            setProcessing(true);
          }
        },
      });

      // Persist the "allow copy link" preference + description on the new video asset
      if (result?.videoId) {
        // Best-effort thumbnail capture from the first frame (silent fail).
        let thumbnailUrl: string | null = null;
        try {
          thumbnailUrl = await captureFirstFrameDataUrl(file);
        } catch {
          thumbnailUrl = null;
        }
        await supabase
          .from("video_assets")
          .update({
            allow_copy_link: allowCopyLink,
            description: cleanDescription || null,
            ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
          })
          .eq("id", result.videoId);
      }

      toast.success("Video uploaded successfully!");
      queryClient.invalidateQueries({ queryKey: ["storage-usage"] });
      onSuccess(result?.videoId);
      // Show the Done/Share step instead of immediately closing.
      setDoneVideoId(result?.videoId || null);
      setUploading(false);
      setProcessing(false);
      return;
    } catch (err: any) {
      const raw = err?.message || "";
      let friendly = "Upload failed. Please check your connection and try again.";
      if (/network|fetch|cors/i.test(raw)) friendly = "Network hiccup — your connection dropped mid-upload. Try again.";
      else if (/timed?\s*out/i.test(raw)) friendly = "Upload timed out. Try a smaller file or a faster network.";
      else if (/quota|storage|limit/i.test(raw)) friendly = raw; // already user-facing from server
      else if (/HTTP\s*4\d\d/i.test(raw)) friendly = "Upload was rejected by the server. Try again or contact support.";
      else if (raw) friendly = raw;
      setError(friendly);
      toast.error(friendly);
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClose = () => {
    if (uploading || processing) return;
    reset();
    onClose();
  };

  const busy = uploading || processing;

  const publicUrl = doneVideoId && typeof window !== "undefined" ? `${window.location.origin}/v/${doneVideoId}` : "";

  const copyDoneLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Public link copied!");
    } catch { toast.error("Could not copy"); }
  };

  const finishAndClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[85svh] overflow-y-auto rounded-2xl p-6 sm:p-7 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-center text-xl">{doneVideoId ? "Video ready 🎉" : "Upload video"}</DialogTitle>
          {!doneVideoId && (
            <p className="text-center text-xs text-muted-foreground">Drop a clip in — we'll handle the rest.</p>
          )}
        </DialogHeader>

        {doneVideoId ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-400" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Your video is live. Share the link anywhere.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 bg-transparent text-xs outline-none px-2"
              />
              <Button size="sm" variant="outline" onClick={copyDoneLink}>
                <Copy size={14} className="mr-1" /> Copy
              </Button>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-1" /> Open
                </a>
              </Button>
              <Button onClick={finishAndClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
          {/* Pro Tip collapsible — dismissible */}
          {!tipDismissed && (
            <Collapsible open={tipOpen} onOpenChange={setTipOpen}>
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10">
                <div className="w-full flex items-center gap-2 p-3 text-left">
                  <Info size={16} className="shrink-0 text-indigo-300" />
                  <CollapsibleTrigger className="flex-1 flex items-center gap-2 text-left">
                    <span className="flex-1 text-sm text-foreground">💡 Best video quality tip</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-muted-foreground transition-transform ${tipOpen ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <button
                    type="button"
                    onClick={dismissTip}
                    aria-label="Dismiss tip"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  >
                    <X size={14} />
                  </button>
                </div>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="px-3 pb-3 text-sm text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">💡 Pro Tip — For Best Playback Quality:</p>
                    <p>
                      Videos downloaded from YouTube play the smoothest on Nevorai. If your video lags or buffers, try this:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 pl-1">
                      <li>Upload your video to YouTube (can be Unlisted)</li>
                      <li>Download it using any YouTube downloader app</li>
                      <li>Upload that downloaded file here</li>
                    </ol>
                    <p>This ensures perfect quality for all your viewers.</p>
                    <Button size="sm" variant="outline" onClick={dismissTip} className="mt-1">Got it →</Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".mp4,.mov,.webm,.m4v,.mkv,.avi,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {!file ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-primary/60 hover:bg-primary/5 transition-all group"
            >
              <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Upload size={26} className="text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                Tap to select a video
              </span>
              <span className="text-xs text-muted-foreground/70 text-center">
                Max 500 MB · MP4 (best), MOV, WEBM, M4V, MKV, AVI
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3.5 bg-muted rounded-xl border border-border">
              <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <FileVideo size={18} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {!busy && (
                <button onClick={() => { setFile(null); setTitle(""); setError(null); setFormatWarning(null); }} className="size-7 rounded-full bg-muted-foreground/10 hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Soft format warning for MOV/WEBM */}
          {formatWarning && !busy && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p className="flex-1 leading-relaxed">⚠️ {formatWarning}</p>
              <button
                onClick={() => setFormatWarning(null)}
                className="shrink-0 text-yellow-300/70 hover:text-yellow-300"
                aria-label="Dismiss warning"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Helper text + tooltip */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>MP4 plays best · MOV / WEBM / M4V / MKV / AVI also accepted · Max 500 MB</span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Format help">
                    <Info size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  For best results, use MP4 format.<br />
                  WhatsApp videos: save as MP4 before uploading.<br />
                  Google Drive: download as MP4 format.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div>
            <Label>Video Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title"
              className="mt-1 bg-muted border-border"
              disabled={busy}
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="mt-1 bg-muted border-border resize-none"
              rows={2}
              disabled={busy}
            />
          </div>

          {/* "Allow others to reuse" lives in Edit Details now (off by default). */}


          {(uploading || processing) && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                {processing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Upload complete! Processing…
                  </span>
                ) : (
                  <span>Uploading… {progress}%{eta ? ` • ${eta}` : ""}</span>
                )}
                {!processing && <span>{progress}%</span>}
              </div>
              <Progress value={processing ? 100 : progress} className="h-2" />
            </div>
          )}

          {error && !busy && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{error}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={runUpload}
                disabled={!file || !title.trim()}
              >
                <RotateCcw size={12} /> Retry
              </Button>
            </div>
          )}

          <Button
            onClick={runUpload}
            disabled={!file || !title.trim() || busy}
            className="w-full h-11 rounded-xl text-sm font-semibold"
            variant="hero"
          >
            {processing ? (
              <><Loader2 size={16} className="animate-spin" /> Processing…</>
            ) : uploading ? (
              <><Loader2 size={16} className="animate-spin" /> Uploading… {progress}%</>
            ) : (
              <><Upload size={16} /> Upload video</>
            )}
          </Button>
        </div>
        )}
      </DialogContent>
      <StorageLimitModal
        open={storageLimitOpen}
        onClose={() => setStorageLimitOpen(false)}
        usedGB={storage.usedGB}
        limitGB={storage.limitGB}
      />
    </Dialog>
  );
};
