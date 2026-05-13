import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Pencil, Copy } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";

interface Props {
  open: boolean;
  onClose: () => void;
  videoId: string;
  currentTitle: string;
  onSuccess: () => void;
}

export const VideoRenameModal = ({ open, onClose, videoId, currentTitle, onSuccess }: Props) => {
  const [title, setTitle] = useState(currentTitle);
  const [allowCopyLink, setAllowCopyLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingFlag, setLoadingFlag] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(currentTitle);
    // Fetch current allow_copy_link value
    setLoadingFlag(true);
    supabase
      .from("video_assets")
      .select("allow_copy_link")
      .eq("id", videoId)
      .maybeSingle()
      .then(({ data }) => {
        setAllowCopyLink(data?.allow_copy_link !== false);
        setLoadingFlag(false);
      });
  }, [open, currentTitle, videoId]);

  const handleSave = async () => {
    const cleanTitle = sanitizeText(title);
    if (!cleanTitle) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("video_assets")
        .update({ title: cleanTitle, allow_copy_link: allowCopyLink })
        .eq("id", videoId);
      if (error) throw error;
      toast.success("Video updated!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[VideoRenameModal]", err);
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Pencil size={16} /> Edit Video
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-muted border-border"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {/* Allow viewers to reuse this video via Nevorai Flow Link */}
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Copy size={13} className="text-primary shrink-0" />
                <Label className="text-sm font-medium cursor-pointer" htmlFor="rename-allow-copy">
                  Allow reuse via Nevorai Flow Link
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Viewers see a "Copy Nevorai Flow Link" button to add this video to their own gallery.
              </p>
            </div>
            <Switch
              id="rename-allow-copy"
              checked={allowCopyLink}
              onCheckedChange={setAllowCopyLink}
              disabled={loadingFlag}
            />
          </div>

          <Button onClick={handleSave} disabled={!title.trim() || loading} className="w-full" variant="hero">
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
