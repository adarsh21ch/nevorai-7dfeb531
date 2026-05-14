import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, Search } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (videoId: string, title: string, publicUrl: string | null, thumbnailUrl?: string | null) => void;
}

export const VideoPickerModal = ({ open, onClose, onSelect }: Props) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: ownVideos = [] } = useQuery({
    queryKey: ["my-videos-picker", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_assets")
        .select("id, title, thumbnail_url, public_url, duration_seconds, status")
        .eq("owner_id", user!.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user && open,
  });

  const { data: sharedVideos = [] } = useQuery({
    queryKey: ["shared-videos-picker", user?.id],
    queryFn: async () => {
      const { data: access } = await supabase
        .from("video_asset_access")
        .select("video_id")
        .eq("granted_to", user!.id);
      if (!access?.length) return [];
      const videoIds = access.map((a) => a.video_id);
      const { data } = await supabase
        .from("video_assets")
        .select("id, title, thumbnail_url, public_url, duration_seconds, status")
        .in("id", videoIds)
        .eq("status", "ready");
      return data || [];
    },
    enabled: !!user && open,
  });

  const allVideos = [...ownVideos, ...sharedVideos.filter((sv) => !ownVideos.find((ov) => ov.id === sv.id))];
  const filtered = allVideos.filter((v) => !search || v.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading">Select Video</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search videos..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Video size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No videos available. Add videos to your gallery first.</p>
            </div>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id, v.title, v.public_url, v.thumbnail_url)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="w-16 flex-shrink-0">
                  <VideoThumbnail thumbnailUrl={v.thumbnail_url} videoUrl={v.public_url} title={v.title} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  {v.duration_seconds && (
                    <p className="text-xs text-muted-foreground">{Math.floor(v.duration_seconds / 60)}:{(v.duration_seconds % 60).toString().padStart(2, "0")}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
