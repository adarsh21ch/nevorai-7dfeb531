import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Upload, Video, Trash2, Loader2, Link2, Share2, Pencil, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "@/lib/router-compat";

const AdminVideosPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["admin-all-videos"],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress(0);
    let videoId: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
        body: { filename: file.name, contentType: file.type, title: title || file.name },
      });
      if (error || !data?.uploadUrl) throw new Error(data?.error || "Failed to get upload URL");

      videoId = data.videoId;
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.onload = () => {
          if (xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.send(file);
      });

      const { error: confirmErr } = await supabase.functions.invoke("confirm-r2-upload", {
        body: { videoId: data.videoId, fileSizeBytes: file.size },
      });
      if (confirmErr) throw new Error("Confirmation failed");

      toast.success("Video uploaded!");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
      if (videoId) {
        try {
          await supabase.functions.invoke("confirm-r2-upload", {
            body: { videoId, failed: true, errorMessage: err.message },
          });
        } catch {}
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("video_assets").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
      toast.success("Video deleted");
    },
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/video/${id}`);
    toast.success("Video link copied!");
  };

  const useInFunnel = (videoId: string) => navigate(`/funnels/create?videoId=${videoId}`);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <h1 className="text-lg font-heading font-bold sm:text-2xl">Video Management</h1>

        <div className="glass-card space-y-3 p-3 sm:p-6">
          <h2 className="text-sm font-heading font-semibold sm:text-base">Upload New Video</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                className="mt-1.5 bg-muted border-border"
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button
              variant="hero"
              className="min-h-[44px] w-full text-sm sm:text-base"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? "Uploading..." : "Upload Video"}
            </Button>
          </div>
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2 bg-muted [&>div]:bg-white" />
              <p className="text-center text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden glass-card overflow-hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-4 text-xs font-medium text-muted-foreground">Video</th>
                  <th className="p-4 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="p-4 text-xs font-medium text-muted-foreground">Size</th>
                  <th className="p-4 text-xs font-medium text-muted-foreground">Views</th>
                  <th className="p-4 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-4"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                      <td className="p-4"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                      <td className="p-4"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                      <td className="p-4"><div className="h-4 w-12 animate-pulse rounded bg-muted" /></td>
                      <td className="p-4"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
                    </tr>
                  ))
                ) : videos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">No videos yet</td>
                  </tr>
                ) : (
                  videos.map((v) => (
                    <tr key={v.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-muted">
                            {v.thumbnail_url ? (
                              <img src={v.thumbnail_url} className="h-full w-full rounded object-cover" />
                            ) : (
                              <Video size={14} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{v.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{v.original_filename}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{formatSize(v.file_size_bytes)}</td>
                      <td className="p-4 text-xs text-muted-foreground">{v.view_count || 0}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRenameVideo({ id: v.id, title: v.title })}><Pencil size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareVideo({ id: v.id, title: v.title })}><Share2 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(v.id)}><Link2 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => useInFunnel(v.id)}><Rocket size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(v.id); }}><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-2.5 sm:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-24 p-3 animate-pulse" />)
          ) : videos.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-muted-foreground">No videos yet</div>
          ) : (
            videos.map((v) => (
              <div key={v.id} className="glass-card space-y-2.5 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Video size={16} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{v.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span>{formatSize(v.file_size_bytes)}</span>
                      <span>·</span>
                      <span>{v.view_count || 0} views</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                        {v.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 border-t border-border pt-2.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-lg"
                    onClick={() => setRenameVideo({ id: v.id, title: v.title })}
                    title="Rename"
                    aria-label="Rename video"
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-lg"
                    onClick={() => setShareVideo({ id: v.id, title: v.title })}
                    title="Share"
                    aria-label="Share video"
                  >
                    <Share2 size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-lg"
                    onClick={() => copyLink(v.id)}
                    title="Copy Link"
                    aria-label="Copy video link"
                  >
                    <Link2 size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-lg"
                    onClick={() => useInFunnel(v.id)}
                    title="Use in Funnel"
                    aria-label="Use video in funnel"
                  >
                    <Rocket size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-full rounded-lg text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(v.id); }}
                    title="Delete"
                    aria-label="Delete video"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] })}
        />
      )}
    </AdminLayout>
  );
};

export default AdminVideosPage;
