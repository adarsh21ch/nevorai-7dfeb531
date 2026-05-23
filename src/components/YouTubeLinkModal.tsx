import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Youtube as YoutubeIcon } from "lucide-react";
import {
  extractYouTubeId,
  fetchYouTubeMeta,
  buildYouTubeWatchUrl,
  type YouTubeMeta,
} from "@/lib/youtube";
import { sanitizeText } from "@/lib/sanitize";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const YouTubeLinkModal = ({ open, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState<YouTubeMeta | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setTitle("");
      setMeta(null);
      setPreviewing(false);
      setSaving(false);
    }
  }, [open]);

  // Auto-preview after debounce
  useEffect(() => {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      setMeta(null);
      return;
    }
    setPreviewing(true);
    const t = setTimeout(async () => {
      const m = await fetchYouTubeMeta(videoId);
      setMeta(m);
      if (m && !title.trim()) setTitle(m.title);
      setPreviewing(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleAdd = async () => {
    if (!user) return;
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      toast.error("Please paste a valid YouTube link.");
      return;
    }
    const cleanTitle = sanitizeText(title || meta?.title || "YouTube video");
    if (!cleanTitle) {
      toast.error("Please enter a title.");
      return;
    }
    setSaving(true);
    try {
      const watchUrl = buildYouTubeWatchUrl(videoId);
      const thumb =
        meta?.thumbnailUrl ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const { error } = await supabase.from("video_assets").insert({
        owner_id: user.id,
        title: cleanTitle,
        public_url: watchUrl,
        thumbnail_url: thumb,
        status: "ready",
        is_shared: true,
        file_size_bytes: 0,
      });
      if (error) throw error;
      toast.success("YouTube video added to your gallery!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add YouTube video");
    } finally {
      setSaving(false);
    }
  };

  const videoId = extractYouTubeId(url);
  const canSave = !!videoId && !saving && !!(title.trim() || meta?.title);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <YoutubeIcon size={18} className="text-[#FF0000]" />
            Add YouTube Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste any YouTube link. We'll play it inside your branded page — no related
            videos, no end-screen suggestions, no distractions for your prospects.
          </p>

          <div>
            <Label className="text-xs">YouTube URL</Label>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 bg-muted border-border"
            />
          </div>

          {/* Preview */}
          {videoId && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/40">
              <div className="relative aspect-video bg-black">
                {previewing && !meta ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={20} className="text-muted-foreground animate-spin" />
                  </div>
                ) : (
                  <img
                    src={
                      meta?.thumbnailUrl ||
                      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                    }
                    alt={meta?.title || "YouTube preview"}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {meta?.authorName && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  by {meta.authorName}
                </div>
              )}
            </div>
          )}

          {videoId && (
            <div>
              <Label className="text-xs">Display title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title shown in your gallery"
                className="mt-1 bg-muted border-border"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!canSave}
              className="flex-1"
              variant="hero"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Add to Gallery"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default YouTubeLinkModal;
