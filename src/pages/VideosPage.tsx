import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Video, Search, Grid, List, Link2, Share2, Pencil, Rocket, Upload, Copy, Trash2, RefreshCw, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VideoLinkModal } from "@/components/VideoLinkModal";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";

const VideosPage = () => {
  useDocumentTitle("Video Gallery");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<{ id: string; title: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");

  const { data: ownVideos = [], isLoading } = useQuery({
    queryKey: ["videos", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sharedVideos = [] } = useQuery({
    queryKey: ["shared-videos", user?.id],
    queryFn: async () => {
      const { data: access } = await supabase.from("video_asset_access").select("video_id").eq("granted_to", user!.id);
      if (!access?.length) return [];
      const videoIds = access.map((a) => a.video_id);
      const { data } = await supabase.from("video_assets").select("*").in("id", videoIds);
      return data || [];
    },
    enabled: !!user,
  });

  const allVideos = [
    ...ownVideos.map((v) => ({ ...v, _source: "own" as const })),
    ...sharedVideos.filter((sv) => !ownVideos.find((ov) => ov.id === sv.id)).map((v) => ({ ...v, _source: "linked" as const })),
  ];

  const counts = {
    all: allVideos.length,
    ready: allVideos.filter((v) => v.status === "ready").length,
    processing: allVideos.filter((v) => v.status !== "ready" && v.status !== "failed").length,
    failed: allVideos.filter((v) => v.status === "failed").length,
  };

  const filtered = allVideos
    .filter((v) => statusFilter === "all" ? true
      : statusFilter === "processing" ? (v.status !== "ready" && v.status !== "failed")
      : v.status === statusFilter)
    .filter((v) => !search || v.title.toLowerCase().includes(search.toLowerCase()));

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (sec: number | null | undefined) => {
    if (!sec || sec <= 0) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const useInFunnel = (videoId: string) => {
    navigate(`/funnels/create?videoId=${videoId}`);
  };

  const copyLink = (videoId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/v/${videoId}`);
    toast.success("Public video link copied!");
  };

  const removeLinkedVideo = async (videoId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("video_asset_access")
      .delete()
      .eq("video_id", videoId)
      .eq("granted_to", user.id);
    if (error) {
      toast.error("Failed to remove video");
    } else {
      toast.success("Video removed from gallery");
      queryClient.invalidateQueries({ queryKey: ["shared-videos"] });
    }
  };

  const deleteOwnedVideo = async (videoId: string) => {
    if (!user) return;
    // Detach from any funnels using this video first to avoid FK / orphaned references.
    await supabase.from("funnels").update({ video_asset_id: null }).eq("video_asset_id", videoId).eq("owner_id", user.id);
    await supabase.from("video_asset_access").delete().eq("video_id", videoId);
    const { error } = await supabase.from("video_assets").delete().eq("id", videoId).eq("owner_id", user.id);
    if (error) {
      toast.error("Failed to delete video");
    } else {
      toast.success("Video deleted");
      invalidateVideos();
    }
    setDeleteVideo(null);
  };

  const retryFailed = async (videoId: string) => {
    const { error } = await supabase.from("video_assets").update({ status: "pending" }).eq("id", videoId).eq("owner_id", user!.id);
    if (error) toast.error("Could not retry");
    else { toast.success("Retry queued"); invalidateVideos(); }
  };

  function invalidateVideos() {
    queryClient.invalidateQueries({ queryKey: ["videos"] });
    queryClient.invalidateQueries({ queryKey: ["shared-videos"] });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full max-w-full">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold">Video Gallery</h1>
            <div className="page-header-accent" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="hero"
              className="flex-1 sm:flex-none"
              onClick={() => setUploadModalOpen(true)}
            >
              <Upload size={16} /> Upload Video
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => setLinkModalOpen(true)}
            >
              <Link2 size={16} /> Add by nFlow Link
            </Button>
          </div>
        </div>

        {/* Search + View toggle */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-full">
          <div className="relative flex-1 min-w-0 search-premium rounded-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search videos..." className="pl-9 bg-muted border-border w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            <button onClick={() => setView("grid")} className={`p-2 rounded-md transition-colors ${view === "grid" ? "bg-card shadow-sm" : ""}`}><Grid size={16} /></button>
            <button onClick={() => setView("list")} className={`p-2 rounded-md transition-colors ${view === "list" ? "bg-card shadow-sm" : ""}`}><List size={16} /></button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit overflow-x-auto max-w-full">
          {([
            { k: "all", label: "All", icon: null },
            { k: "ready", label: "Ready", icon: <CheckCircle2 size={13} className="text-success" /> },
            { k: "processing", label: "Processing", icon: <Loader2 size={13} className="text-warning animate-spin" /> },
            { k: "failed", label: "Failed", icon: <AlertTriangle size={13} className="text-destructive" /> },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setStatusFilter(t.k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === t.k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon}
              {t.label}
              <span className="text-[10px] tabular-nums opacity-70">({counts[t.k]})</span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="glass-card p-8 sm:p-12 text-center w-full max-w-full">
            <Video size={40} className="text-muted-foreground mx-auto mb-3" />
            <h3 className="font-heading font-semibold mb-2">{search ? "No videos found" : "No videos yet"}</h3>
            <p className="text-sm text-muted-foreground mb-6">Upload a video or add one using an nFlow link.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" onClick={() => setUploadModalOpen(true)}>
                <Upload size={16} /> Upload Video
              </Button>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setLinkModalOpen(true)}>
                <Link2 size={16} /> Add by nFlow Link
              </Button>
            </div>
          </div>
        ) : (
          <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full" : "space-y-2 w-full max-w-full"}>
            {filtered.map((v) => (
              <div key={v.id} className="premium-card p-3 sm:p-4 w-full max-w-full box-border min-w-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden w-full max-w-full">
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover rounded-lg block" /> :
                    v.public_url ? <video src={v.public_url} preload="metadata" playsInline muted className="w-full h-full object-cover rounded-lg block" /> :
                    <Video size={24} className="text-muted-foreground" />}
                  {formatDuration(v.duration_seconds) && (
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/75 text-white tabular-nums">
                      <Clock size={10} className="inline mr-1 -mt-0.5" />{formatDuration(v.duration_seconds)}
                    </span>
                  )}
                  {v.status !== "ready" && v.status !== "failed" && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                  {v.status === "failed" && (
                    <div className="absolute inset-0 bg-destructive/30 flex items-center justify-center">
                      <AlertTriangle size={22} className="text-destructive-foreground" />
                    </div>
                  )}
                </div>

                {/* Title & meta */}
                <h3 className="font-medium text-sm truncate max-w-full overflow-hidden">{v.title}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span>{formatSize(v.file_size_bytes)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                    {v.status}
                  </span>
                  {v._source === "linked" ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">Added via Link</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted-foreground/10 text-muted-foreground">Uploaded</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1 mt-3 border-t border-border pt-3 w-full">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setRenameVideo({ id: v.id, title: v.title })} title="Rename">
                    <Pencil size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => copyLink(v.id)} title="Copy Link" disabled={v.status !== "ready"}>
                    <Copy size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setShareVideo({ id: v.id, title: v.title })} title="Share" disabled={v.status !== "ready"}>
                    <Share2 size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => useInFunnel(v.id)} title="Use in Funnel" disabled={v.status !== "ready"}>
                    <Rocket size={15} />
                  </Button>
                  {v._source === "own" && v.status === "failed" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-warning hover:text-warning" onClick={() => retryFailed(v.id)} title="Retry">
                      <RefreshCw size={15} />
                    </Button>
                  )}
                  {v._source === "linked" ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => removeLinkedVideo(v.id)} title="Remove from gallery">
                      <Trash2 size={15} />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => setDeleteVideo({ id: v.id, title: v.title })} title="Delete">
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modals */}
        <VideoUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={invalidateVideos}
        />

        <VideoLinkModal
          open={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["shared-videos"] })}
        />

        {shareVideo && (
          <VideoShareModal
            open={!!shareVideo}
            onClose={() => setShareVideo(null)}
            videoId={shareVideo.id}
            videoTitle={shareVideo.title}
          />
        )}

        {renameVideo && (
          <VideoRenameModal
            open={!!renameVideo}
            onClose={() => setRenameVideo(null)}
            videoId={renameVideo.id}
            currentTitle={renameVideo.title}
            onSuccess={invalidateVideos}
          />
        )}

        <AlertDialog open={!!deleteVideo} onOpenChange={(o) => !o && setDeleteVideo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this video?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteVideo?.title}" will be permanently removed. Any funnels using it will be detached. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteVideo && deleteOwnedVideo(deleteVideo.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default VideosPage;
