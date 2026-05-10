import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VideoLinkModal = ({ open, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const extractVideoId = (url: string): string | null => {
    // Support /video/UUID format
    const match = url.match(/\/video\/([0-9a-f-]{36})/i);
    if (match) return match[1];
    // Also support raw UUID
    const uuidMatch = url.match(/^[0-9a-f-]{36}$/i);
    if (uuidMatch) return uuidMatch[0];
    return null;
  };

  const handleAdd = async () => {
    if (!user) return;
    const videoId = extractVideoId(link.trim());
    if (!videoId) {
      toast.error("Invalid video link. Use a nFlow video URL.");
      return;
    }

    setLoading(true);
    try {
      // Check video exists and is shared
      const { data: video, error } = await supabase
        .from("video_assets")
        .select("id, title, is_shared")
        .eq("id", videoId)
        .single();

      if (error || !video) {
        toast.error("Video not found. Check the link and try again.");
        return;
      }

      if (!video.is_shared) {
        toast.error("This video is not available for sharing.");
        return;
      }

      // Check if already added
      const { data: existing } = await supabase
        .from("video_asset_access")
        .select("id")
        .eq("video_id", videoId)
        .eq("granted_to", user.id)
        .maybeSingle();

      if (existing) {
        toast.info("You already have this video in your gallery.");
        onClose();
        return;
      }

      // Grant access
      const { error: insertError } = await supabase.from("video_asset_access").insert({
        video_id: videoId,
        granted_to: user.id,
        granted_by: user.id,
      });

      if (insertError) throw insertError;

      toast.success(`"${video.title}" added to your gallery!`);
      setLink("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to add video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Add Video by Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Paste a nFlow video link to add it to your gallery.</p>
          <div>
            <Label>Video Link</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://...nevorai.../video/abc-123..."
              className="mt-1 bg-muted border-border"
            />
          </div>
          <Button onClick={handleAdd} disabled={!link.trim() || loading} className="w-full" variant="hero">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            {loading ? "Adding..." : "Add to Gallery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
