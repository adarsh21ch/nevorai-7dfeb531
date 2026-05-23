import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings, Info, FastForward, Calendar, Lock } from "lucide-react";
import { sanitizeText } from "@/lib/sanitize";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "@/lib/router-compat";

interface Props {
  open: boolean;
  onClose: () => void;
  videoId: string;
  onSuccess: () => void;
}

export const VideoDetailsModal = ({ open, onClose, videoId, onSuccess }: Props) => {
  const isMobile = useIsMobile();
  const { features } = usePlanLimits();
  const navigate = useNavigate();
  const skipUnlocked = features.skipControl;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowSeek, setAllowSeek] = useState(true);
  const [showUploadDate, setShowUploadDate] = useState(true);
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSkipInfo, setShowSkipInfo] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHydrating(true);
    setShowSkipInfo(false);
    (async () => {
      const { data } = await (supabase as any)
        .from("video_assets")
        .select("*")
        .eq("id", videoId)
        .maybeSingle();
      setTitle(data?.title || "");
      setDescription(data?.description || "");
      setAllowSeek(data?.allow_seek !== false);
      setShowUploadDate(data?.show_upload_date !== false);
      setHydrating(false);
    })();
  }, [open, videoId]);

  const handleSave = async () => {
    const cleanTitle = sanitizeText(title);
    if (!cleanTitle) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: cleanTitle,
        description: description.trim() || null,
        allow_seek: allowSeek,
        show_upload_date: showUploadDate,
      };
      let { error } = await (supabase as any)
        .from("video_assets")
        .update(payload)
        .eq("id", videoId);
      if (error && /show_upload_date/i.test(error.message || "")) {
        // Column not yet migrated — retry without it.
        const { show_upload_date: _omit, ...fallback } = payload;
        const retry = await (supabase as any)
          .from("video_assets")
          .update(fallback)
          .eq("id", videoId);
        error = retry.error;
      }
      if (error) throw error;
      toast.success("Video updated");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Settings size={16} /> Edit Video Details
          </DialogTitle>
        </DialogHeader>

        {hydrating ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 bg-muted border-border"
                placeholder="Video title"
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 bg-muted border-border resize-none"
                placeholder="Tell viewers what this video is about (optional)"
              />
            </div>

            {/* Skip control */}
            <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <FastForward size={13} className="text-primary shrink-0" />
                    <Label className="text-sm font-medium cursor-pointer" htmlFor="allow-seek">
                      Allow viewers to skip forward
                    </Label>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setShowSkipInfo((v) => !v)}
                        aria-label="About skip control"
                        className="ml-auto text-muted-foreground hover:text-foreground"
                      >
                        <Info size={13} />
                      </button>
                    )}
                  </div>
                  {!isMobile && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      <Info size={10} className="inline mr-1 -mt-0.5" />
                      When disabled, viewers must watch the full video before they can skip.
                      Great for sales videos, course previews, or any content where completion matters.
                    </p>
                  )}
                </div>
                <Switch
                  id="allow-seek"
                  checked={skipUnlocked ? allowSeek : true}
                  disabled={!skipUnlocked}
                  onCheckedChange={setAllowSeek}
                />
              </div>

              {!skipUnlocked && (
                <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-[11px] leading-relaxed flex items-start gap-2">
                  <Lock size={12} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="text-foreground font-medium">Skip-forward control is a paid feature.</span>{" "}
                    <span className="text-muted-foreground">Upgrade to unlock this on all your videos.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate("/pricing"); }}
                    className="text-[11px] font-semibold text-primary hover:underline shrink-0"
                  >
                    Upgrade
                  </button>
                </div>
              )}

              {isMobile && showSkipInfo && (
                <div className="rounded-md bg-background/60 border border-border p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  When disabled, viewers must watch the full video before they can skip.
                  Great for sales videos, course previews, or any content where completion matters.
                  <button
                    type="button"
                    onClick={() => setShowSkipInfo(false)}
                    className="block ml-auto mt-2 text-primary font-medium"
                  >
                    Got it
                  </button>
                </div>
              )}
            </div>

            {/* Show upload date toggle */}
            <div className="rounded-lg bg-muted/40 border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-primary shrink-0" />
                    <Label className="text-sm font-medium cursor-pointer" htmlFor="show-date">
                      Show upload date on public page
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    When disabled, viewers won't see when the video was uploaded.
                  </p>
                </div>
                <Switch
                  id="show-date"
                  checked={showUploadDate}
                  onCheckedChange={setShowUploadDate}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!title.trim() || saving} className="flex-1" variant="hero">
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoDetailsModal;
