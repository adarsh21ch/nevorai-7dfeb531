import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Share2, UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
}

export const VideoShareModal = ({ open, onClose, videoId, videoTitle }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: sharedWith = [], refetch } = useQuery({
    queryKey: ["video-shared-users", videoId],
    queryFn: async () => {
      const { data: access } = await supabase
        .from("video_asset_access")
        .select("id, granted_to, granted_at")
        .eq("video_id", videoId);
      if (!access?.length) return [];
      const userIds = access.map((a) => a.granted_to);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      return access.map((a) => ({
        ...a,
        profile: profiles?.find((p) => p.id === a.granted_to),
      }));
    },
    enabled: open && !!videoId,
  });

  const handleShare = async () => {
    if (!user || !email.trim()) return;
    setLoading(true);
    try {
      // Find user by email
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileErr || !profile) {
        toast.error("No user found with that email address.");
        return;
      }

      if (profile.id === user.id) {
        toast.error("You can't share with yourself.");
        return;
      }

      // Check if already shared
      const { data: existing } = await supabase
        .from("video_asset_access")
        .select("id")
        .eq("video_id", videoId)
        .eq("granted_to", profile.id)
        .maybeSingle();

      if (existing) {
        toast.info(`Already shared with ${profile.full_name || profile.email}`);
        return;
      }

      // First ensure the video is marked as shared
      await supabase
        .from("video_assets")
        .update({ is_shared: true })
        .eq("id", videoId);

      // Grant access
      const { error: insertErr } = await supabase.from("video_asset_access").insert({
        video_id: videoId,
        granted_to: profile.id,
        granted_by: user.id,
      });

      if (insertErr) throw insertErr;

      toast.success(`Shared "${videoTitle}" with ${profile.full_name || profile.email}!`);
      setEmail("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to share video");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (accessId: string) => {
    try {
      await supabase.from("video_asset_access").delete().eq("id", accessId);
      toast.success("Access revoked");
      refetch();
    } catch {
      toast.error("Failed to revoke access");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Share2 size={18} /> Share Video
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Share <span className="font-medium text-foreground">"{videoTitle}"</span> with a user by their login email.
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">User Email</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-muted border-border flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
              />
              <Button onClick={handleShare} disabled={!email.trim() || loading} variant="hero" size="sm">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              </Button>
            </div>
          </div>

          {sharedWith.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Shared with</Label>
              {sharedWith.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                  <div>
                    <p className="font-medium text-xs">{s.profile?.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{s.profile?.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => handleRevoke(s.id)}>
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
