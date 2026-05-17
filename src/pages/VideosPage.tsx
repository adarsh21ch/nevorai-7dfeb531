import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { Search, Grid, List, Link2, Share2, Pencil, Rocket, Upload, Copy, Trash2, RefreshCw, Loader2, Settings, Play, MoreVertical, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VideoLinkModal } from "@/components/VideoLinkModal";
import { VideoUploadModal } from "@/components/VideoUploadModal";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { VideoDetailsModal } from "@/components/VideoDetailsModal";
import { StorageUsageInline } from "@/components/StorageUsageCard";
import { VideoThumbnail } from "@/components/VideoThumbnail";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const buildPublicVideoUrl = (v: { id: string; slug?: string | null }) =>
  `${window.location.origin}/v/${v.slug || v.id}`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getDisplayTitle = (raw?: string | null): string => {
  const t = (raw || "").trim();
  if (!t || UUID_RE.test(t)) return "Untitled Video";
  return t;
};

const VideoStatusBadge = ({ status }: { status: string | null | undefined }) => {
  const map: Record<string, { label: string; className: string }> = {
    ready:      { label: "✓ Ready",       className: "bg-success/10 text-success border border-success/20" },
    processing: { label: "⏳ Processing",  className: "bg-warning/10 text-warning border border-warning/20" },
    pending:    { label: "⏳ Processing",  className: "bg-warning/10 text-warning border border-warning/20" },
    failed:     { label: "✗ Failed",      className: "bg-destructive/10 text-destructive border border-destructive/20" },
    uploaded:   { label: "Uploaded",      className: "bg-primary/10 text-primary border border-primary/20" },
    draft:      { label: "Draft",         className: "bg-muted text-muted-foreground border border-border" },
  };
  const cfg = map[(status || "").toLowerCase()] ?? map.draft;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};


const VideosPage = () => {
  useDocumentTitle("My Videos");
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [view, setView] = useState<"grid" | "list">("list");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const openUploadFlow = () => uploadInputRef.current?.click();
  const handleUploadPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    e.target.value = "";
    if (!f) return;
    setPendingFile(f);
    setUploadModalOpen(true);
  };
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);
  const [detailsVideo, setDetailsVideo] = useState<{ id: string } | null>(null);
  const [deleteVideo, setDeleteVideo] = useState<{ id: string; title: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");

  const { data: ownVideos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["videos", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    placeholderData: keepPreviousData,
    enabled: !!user?.id,
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
    placeholderData: keepPreviousData,
    enabled: !!user?.id,
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
    .filter((v) => !debouncedSearch || v.title.toLowerCase().includes(debouncedSearch.toLowerCase()));

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
    navigate({ to: "/funnels/create", search: { videoId } });
  };

  const copyLink = (v: { id: string; slug?: string | null }) => {
    navigator.clipboard.writeText(buildPublicVideoUrl(v));
    toast.success("Link copied!");
  };

  const shareWhatsApp = (v: { id: string; slug?: string | null; title: string }) => {
    const url = buildPublicVideoUrl(v);
    const text = encodeURIComponent(`Watch this video: ${v.title}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold">My Videos</h1>
            <StorageUsageInline />
          </div>
          <Button size="sm" onClick={openUploadFlow} className="flex items-center gap-1.5">
            <Upload size={14} /> Upload Video
          </Button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".mp4,.mov,.webm,.m4v,.mkv,.avi,video/*"
            className="hidden"
            onChange={handleUploadPicked}
          />
        </div>

        <div className="-mt-2">
          <button
            onClick={() => setLinkModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
          >
            <Link2 size={12} /> Add via Nevorai Link
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
          />
          <div className="hidden sm:flex gap-1 ml-2">
            <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-card shadow-sm" : "text-muted-foreground")}><List size={14} /></button>
            <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-card shadow-sm" : "text-muted-foreground")}><Grid size={14} /></button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {([
            { k: "all", label: "All" },
            { k: "ready", label: "Ready" },
            { k: "processing", label: "Processing" },
            { k: "failed", label: "Failed" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setStatusFilter(t.k)}
              className={cn(
                "flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors",
                statusFilter === t.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label} ({counts[t.k]})
            </button>
          ))}
        </div>

        {/* Empty / loading / error states */}
        {authLoading || isLoading ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Loader2 size={22} className="text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading videos...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Play size={22} className="text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Couldn’t load videos</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-[280px] mx-auto">Please try again.</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Play size={22} className="text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">{search ? "No videos found" : "No videos yet"}</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-[280px] mx-auto">Upload a video and share it with your clients. See exactly who watches and how much.</p>
            <Button onClick={openUploadFlow}>
              <Upload size={14} className="mr-1.5" /> Upload Your First Video
            </Button>
          </div>
        ) : (isMobile || view === "list") ? (
          /* COMPACT LIST — YouTube Studio style */
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            {filtered.map((v) => {
              const title = getDisplayTitle(v.title);
              const isReady = v.status === "ready";
              const isFailed = v.status === "failed";
              const dur = formatDuration(v.duration_seconds);
              const dateLabel = v.created_at ? new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
              const goEdit = () => isReady && v._source === "own" && setDetailsVideo({ id: v.id });
              const goPreview = () => {
                if (!isReady) return;
                const url = `/v/${v.slug || v.id}`;
                if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
                  window.open(url, "_blank", "noopener,noreferrer");
                } else {
                  window.location.href = url;
                }
              };
              return (
                <div
                  key={v.id}
                  onClick={goPreview}
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-20">
                    <VideoThumbnail thumbnailUrl={v.thumbnail_url} videoUrl={v.public_url} title={title} />
                    {dur && (
                      <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[9px] font-medium px-1 py-0.5 rounded">{dur}</span>
                    )}
                    {!isReady && !isFailed && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                        <Loader2 size={14} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-snug">{title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <VideoStatusBadge status={v.status} />
                      <span className="text-[11px] text-muted-foreground">{formatSize(v.file_size_bytes)}</span>
                      {dateLabel && <>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">{dateLabel}</span>
                      </>}
                      {v._source === "linked" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Linked</span>
                      )}
                    </div>
                  </div>

                  {/* Inline actions */}
                  {isReady && (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Desktop: visible buttons */}
                      <button
                        onClick={() => copyLink(v)}
                        className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                        title="Copy share link"
                      >
                        <Copy size={13} /> Copy Link
                      </button>
                      {v._source === "own" && (
                        <>
                          <button
                            onClick={() => navigate({ to: "/insights" })}
                            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                            title="View insights"
                          >
                            <Users size={13} /> Insights
                          </button>
                          <button
                            onClick={() => useInFunnel(v.id)}
                            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                            title="Use in a funnel"
                          >
                            <Rocket size={13} /> Use in Funnel
                          </button>
                        </>
                      )}
                      {/* Mobile: single Copy Link icon */}
                      <button
                        onClick={() => copyLink(v)}
                        className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
                        aria-label="Copy share link"
                        title="Copy link"
                      >
                        <Copy size={15} className="text-muted-foreground" />
                      </button>
                    </div>
                  )}

                  {/* Kebab menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                        aria-label="Video options"
                      >
                        <MoreVertical size={15} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => setRenameVideo({ id: v.id, title: v.title })}>
                        <Pencil size={13} className="mr-2" /> Edit Title
                      </DropdownMenuItem>
                      {v._source === "own" && isReady && (
                        <DropdownMenuItem onSelect={() => setDetailsVideo({ id: v.id })}>
                          <Settings size={13} className="mr-2" /> Edit Details
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem disabled={!isReady} onSelect={() => copyLink(v)}>
                        <Copy size={13} className="mr-2" /> Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!isReady} onSelect={() => setShareVideo({ id: v.id, title: v.title })}>
                        <Share2 size={13} className="mr-2" /> Share with User
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!isReady} onSelect={() => useInFunnel(v.id)}>
                        <Rocket size={13} className="mr-2" /> Use in Funnel
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigate({ to: "/leads" })}>
                        <Users size={13} className="mr-2" /> View Insights
                      </DropdownMenuItem>
                      {v._source === "own" && isFailed && (
                        <DropdownMenuItem onSelect={() => retryFailed(v.id)}>
                          <RefreshCw size={13} className="mr-2" /> Retry Upload
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {v._source === "linked" ? (
                        <DropdownMenuItem onSelect={() => removeLinkedVideo(v.id)} className="text-destructive focus:text-destructive">
                          <Trash2 size={13} className="mr-2" /> Remove from Gallery
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setDeleteVideo({ id: v.id, title: v.title })} className="text-destructive focus:text-destructive">
                          <Trash2 size={13} className="mr-2" /> Delete Video
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          /* GRID — desktop opt-in */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v) => {
              const title = getDisplayTitle(v.title);
              return (
                <div key={v.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors">
                  <div className="relative">
                    <VideoThumbnail thumbnailUrl={v.thumbnail_url} videoUrl={v.public_url} title={title} className="rounded-none" />
                    {formatDuration(v.duration_seconds) && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">{formatDuration(v.duration_seconds)}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <VideoStatusBadge status={v.status} />
                      <span className="text-[11px] text-muted-foreground">{formatSize(v.file_size_bytes)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <Button variant="ghost" size="sm" disabled={v.status !== "ready"} onClick={() => copyLink(v)}><Copy size={13} className="mr-1" /> Copy</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-muted"><MoreVertical size={15} className="text-muted-foreground" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => setRenameVideo({ id: v.id, title: v.title })}><Pencil size={13} className="mr-2" /> Edit Title</DropdownMenuItem>
                          {v._source === "own" && v.status === "ready" && (
                            <DropdownMenuItem onSelect={() => setDetailsVideo({ id: v.id })}><Settings size={13} className="mr-2" /> Edit Details</DropdownMenuItem>
                          )}
                          <DropdownMenuItem disabled={v.status !== "ready"} onSelect={() => shareWhatsApp(v)}><Share2 size={13} className="mr-2" /> WhatsApp</DropdownMenuItem>
                          <DropdownMenuItem disabled={v.status !== "ready"} onSelect={() => setShareVideo({ id: v.id, title: v.title })}><Share2 size={13} className="mr-2" /> Share</DropdownMenuItem>
                          <DropdownMenuItem disabled={v.status !== "ready"} onSelect={() => useInFunnel(v.id)}><Rocket size={13} className="mr-2" /> Use in Funnel</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {v._source === "linked" ? (
                            <DropdownMenuItem onSelect={() => removeLinkedVideo(v.id)} className="text-destructive focus:text-destructive"><Trash2 size={13} className="mr-2" /> Remove</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setDeleteVideo({ id: v.id, title: v.title })} className="text-destructive focus:text-destructive"><Trash2 size={13} className="mr-2" /> Delete</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modals */}
        <VideoUploadModal
          open={uploadModalOpen}
          onClose={() => { setUploadModalOpen(false); setPendingFile(null); }}
          onSuccess={invalidateVideos}
          initialFile={pendingFile}
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

        {detailsVideo && (
          <VideoDetailsModal
            open={!!detailsVideo}
            onClose={() => setDetailsVideo(null)}
            videoId={detailsVideo.id}
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
