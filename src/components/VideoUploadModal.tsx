import { useState, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileVideo, Loader2, Info, AlertCircle, RotateCcw, ChevronDown, AlertTriangle, Copy, ExternalLink, CheckCircle2, Layers, FileText, Radio } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { sanitizeText, sanitizeFilename } from "@/lib/sanitize";
import { Link } from "@/lib/router-compat";
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".webm"];
const ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_SIZE_BYTES = 500 * 1024 * 1024;

type AcceptResult = "ok" | "warn" | "reject";

const checkVideoAcceptance = (file: File): AcceptResult => {
  const name = file.name.toLowerCase();
  const isMp4 = name.endsWith(".mp4") || file.type === "video/mp4";
  if (isMp4) return "ok";

  const extOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeOk = file.type ? ALLOWED_MIME_TYPES.includes(file.type) : true;
  if (extOk && mimeOk) return "warn";
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
  "This format may not play correctly on all devices. For best results, upload a video downloaded from YouTube, or convert to MP4 using cloudconvert.com";
const FORMAT_REJECT_MSG =
  "This format may not play correctly. For best results, upload a video downloaded from YouTube, or convert your video to MP4 using cloudconvert.com";

export const VideoUploadModal = ({ open, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
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
  const [allowCopyLink, setAllowCopyLink] = useState(true);
  const [doneVideoId, setDoneVideoId] = useState<string | null>(null);

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
    setAllowCopyLink(true);
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
      toast.error("Video too large. Maximum size is 500MB. Please compress your video first.", { duration: 6000 });
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
        await supabase
          .from("video_assets")
          .update({ allow_copy_link: allowCopyLink, description: cleanDescription || null })
          .eq("id", result.videoId);
      }

      toast.success("Video uploaded successfully!");
      onSuccess();
      // Show the Done/Share step instead of immediately closing.
      setDoneVideoId(result?.videoId || null);
      setUploading(false);
      setProcessing(false);
      return;
    } catch (err: any) {
      const msg = err?.message || "Upload failed. Please try again.";
      setError(msg);
      toast.error(msg);
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
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{doneVideoId ? "Video ready 🎉" : "Upload Video"}</DialogTitle>
        </DialogHeader>

        {doneVideoId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3">
              <CheckCircle2 size={20} className="text-success shrink-0" />
              <p className="text-sm">
                Your video is uploaded. Share the link, or use it in a funnel, landing page, or live session.
              </p>
            </div>

            <div>
              <Label className="text-xs">Public link</Label>
              <div className="mt-1.5 flex gap-2">
                <Input readOnly value={publicUrl} className="bg-muted border-border text-xs" />
                <Button variant="outline" size="icon" onClick={copyDoneLink}><Copy size={14} /></Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <WhatsAppShareButton url={publicUrl} className="w-full" />
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full"><ExternalLink size={14} /> Open</Button>
              </a>
              <Link to={`/videos/${doneVideoId}` as any} onClick={finishAndClose}>
                <Button variant="outline" className="w-full"><FileVideo size={14} /> Edit</Button>
              </Link>
            </div>

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Use this video in</p>
              <div className="grid grid-cols-3 gap-2">
                <Link to={`/funnels/create?videoId=${doneVideoId}` as any} onClick={finishAndClose}>
                  <Button variant="hero" className="w-full"><Layers size={14} /> Funnel</Button>
                </Link>
                <Link to={`/landing-pages/create?videoId=${doneVideoId}` as any} onClick={finishAndClose}>
                  <Button variant="outline" className="w-full"><FileText size={14} /> LP</Button>
                </Link>
                <Link to={`/live?videoId=${doneVideoId}` as any} onClick={finishAndClose}>
                  <Button variant="outline" className="w-full"><Radio size={14} /> Live</Button>
                </Link>
              </div>
            </div>

            <Button variant="ghost" className="w-full" onClick={finishAndClose}>Done</Button>
          </div>
        ) : (
        <div className="space-y-4">
          {/* Pro Tip collapsible */}
          <Collapsible open={tipOpen} onOpenChange={setTipOpen}>
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10">
              <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 text-left">
                <Info size={16} className="shrink-0 text-indigo-300" />
                <span className="flex-1 text-sm text-foreground">💡 Best video quality tip</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-muted-foreground transition-transform ${tipOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="px-3 pb-3 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">💡 Pro Tip — For Best Playback Quality:</p>
                  <p>
                    Videos downloaded from YouTube play the smoothest on nFlow by Nevorai. If your video lags or buffers, try this:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Upload your video to YouTube (can be Unlisted)</li>
                    <li>Download it using any YouTube downloader app</li>
                    <li>Upload that downloaded file here</li>
                  </ol>
                  <p>This ensures perfect quality for all your viewers.</p>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <input
            ref={fileRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />

          {!file ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 transition-colors"
            >
              <Upload size={32} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Tap to select a video file
              </span>
              <span className="text-xs text-muted-foreground/60">
                Max 500MB · MP4, MOV, WebM
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileVideo size={20} className="text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
              </div>
              {!busy && (
                <button onClick={() => { setFile(null); setTitle(""); setError(null); setFormatWarning(null); }} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
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
            <span>Supported: MP4, MOV, WEBM | Max: 500MB | YouTube downloads work best ✓</span>
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

          {/* Allow viewers to reuse this video via nFlow by Nevorai Link */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Copy size={13} className="text-primary shrink-0" />
                <Label className="text-sm font-medium cursor-pointer" htmlFor="allow-copy-link">
                  Allow others to reuse this video
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Public viewers see a "Copy nFlow by Nevorai Link" button so they can add this video to their own gallery. Daily view limits still apply.
              </p>
            </div>
            <Switch
              id="allow-copy-link"
              checked={allowCopyLink}
              onCheckedChange={setAllowCopyLink}
              disabled={busy}
            />
          </div>

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
            className="w-full"
            variant="hero"
          >
            {processing ? (
              <><Loader2 size={16} className="animate-spin" /> Processing…</>
            ) : uploading ? (
              <><Loader2 size={16} className="animate-spin" /> Uploading… {progress}%</>
            ) : (
              <><Upload size={16} /> Upload Video</>
            )}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
