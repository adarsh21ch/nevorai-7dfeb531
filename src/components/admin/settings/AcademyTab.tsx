import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase, supabaseProjectUrl, supabasePublishableKey } from "@/integrations/supabase/client";
import { sanitizeFilename } from "@/lib/sanitize";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GraduationCap,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

type Tutorial = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
  is_published: boolean;
};

type UploadState = {
  error: string | null;
  fileName: string;
  progress: number;
  uploading: boolean;
};

const CATEGORIES = [
  { value: "getting-started", label: "Getting started" },
  { value: "videos", label: "Videos" },
  { value: "funnels", label: "Funnels" },
  { value: "landing-pages", label: "Landing pages" },
  { value: "live", label: "Live sessions" },
  { value: "sharing", label: "Share & WhatsApp" },
  { value: "billing", label: "Billing & plans" },
  { value: "advanced", label: "Advanced" },
];

const emptyForm = {
  title: "",
  description: "",
  video_url: "",
  thumbnail_url: "",
  category: "getting-started",
  is_published: true,
};

const emptyUploadState: UploadState = {
  error: null,
  fileName: "",
  progress: 0,
  uploading: false,
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const normaliseUploadError = (error: unknown, kind: "video" | "thumbnail") => {
  const message = error instanceof Error ? error.message : String(error || "");

  if (/maximum allowed size/i.test(message)) {
    return "This file is still hitting the current Supabase bucket size limit. Please re-check that the academy-videos bucket was updated in the same project.";
  }

  if (/mime|content type/i.test(message)) {
    return `This ${kind} format is not accepted by storage. Please try a standard ${kind === "video" ? "MP4/WebM" : "JPG/PNG/WebP"} file.`;
  }

  if (/401|jwt|token|unauthorized/i.test(message)) {
    return "Your session expired. Refresh the page and sign in again, then retry the upload.";
  }

  return message || `${kind === "video" ? "Video" : "Thumbnail"} upload failed.`;
};

const uploadToAcademyBucket = async ({
  file,
  folder,
  onProgress,
}: {
  file: File;
  folder: "videos" | "thumbnails";
  onProgress?: (progress: number) => void;
}) => {
  const { data: authData } = await supabase.auth.getSession();
  const accessToken = authData.session?.access_token;

  if (!accessToken) {
    throw new Error("Unauthorized");
  }

  const safeName = sanitizeFilename(file.name || `${folder}-file`);
  const path = ["academy", folder, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`].join("/");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const endpoint = `${supabaseProjectUrl}/storage/v1/object/academy-videos/${encodedPath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", endpoint);
    xhr.timeout = folder === "videos" ? 30 * 60 * 1000 : 10 * 60 * 1000;
    xhr.setRequestHeader("apikey", supabasePublishableKey);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText || "{}");
        reject(new Error(parsed.message || parsed.error || `Upload failed (HTTP ${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });

  const { data } = supabase.storage.from("academy-videos").getPublicUrl(path);
  return data.publicUrl;
};

export const AcademyTab = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [videoUpload, setVideoUpload] = useState<UploadState>(emptyUploadState);
  const [thumbnailUpload, setThumbnailUpload] = useState<UploadState>(emptyUploadState);
  const videoRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["academy-tutorials-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("academy_tutorials")
        .select("*")
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as Tutorial[];
    },
  });

  const byCategory = useMemo(
    () => CATEGORIES.map((c) => ({
      ...c,
      items: tutorials.filter((t) => t.category === c.value).sort((a, b) => a.order_index - b.order_index),
    })),
    [tutorials],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
    setVideoUpload(emptyUploadState);
    setThumbnailUpload(emptyUploadState);
    if (videoRef.current) videoRef.current.value = "";
    if (thumbnailRef.current) thumbnailRef.current.value = "";
  };

  const startEdit = (t: Tutorial) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || "",
      video_url: t.video_url,
      thumbnail_url: t.thumbnail_url || "",
      category: t.category,
      is_published: t.is_published,
    });
    setVideoUpload(emptyUploadState);
    setThumbnailUpload(emptyUploadState);
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.video_url.trim()) throw new Error("Please upload or paste a video URL");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        video_url: form.video_url.trim(),
        thumbnail_url: form.thumbnail_url.trim() || null,
        category: form.category,
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("academy_tutorials")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }

      const max = Math.max(
        0,
        ...tutorials.filter((t) => t.category === form.category).map((t) => t.order_index),
      );

      const { error } = await (supabase as any)
        .from("academy_tutorials")
        .insert({ ...payload, order_index: max + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-tutorials-admin"] });
      qc.invalidateQueries({ queryKey: ["academy-tutorials-public"] });
      toast.success(editing ? "Tutorial updated" : "Tutorial added");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("academy_tutorials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-tutorials-admin"] });
      qc.invalidateQueries({ queryKey: ["academy-tutorials-public"] });
      toast.success("Deleted");
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, dir, category }: { id: string; dir: "up" | "down"; category: string }) => {
      const list = tutorials.filter((t) => t.category === category).sort((a, b) => a.order_index - b.order_index);
      const idx = list.findIndex((t) => t.id === id);
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;

      const a = list[idx];
      const b = list[swap];

      await (supabase as any).from("academy_tutorials").update({ order_index: b.order_index }).eq("id", a.id);
      await (supabase as any).from("academy_tutorials").update({ order_index: a.order_index }).eq("id", b.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-tutorials-admin"] });
      qc.invalidateQueries({ queryKey: ["academy-tutorials-public"] });
    },
  });

  const handleVideoUpload = async (file: File) => {
    if (!file) return;

    setVideoUpload({ error: null, fileName: file.name, progress: 0, uploading: true });

    try {
      const publicUrl = await uploadToAcademyBucket({
        file,
        folder: "videos",
        onProgress: (progress) => setVideoUpload((prev) => ({ ...prev, progress })),
      });

      setForm((prev) => ({ ...prev, video_url: publicUrl }));
      setVideoUpload({ error: null, fileName: file.name, progress: 100, uploading: false });
      toast.success("Video uploaded successfully");
    } catch (error) {
      const message = normaliseUploadError(error, "video");
      setVideoUpload({ error: message, fileName: file.name, progress: 0, uploading: false });
      toast.error(message);
    } finally {
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!file) return;

    setThumbnailUpload({ error: null, fileName: file.name, progress: 0, uploading: true });

    try {
      const publicUrl = await uploadToAcademyBucket({
        file,
        folder: "thumbnails",
        onProgress: (progress) => setThumbnailUpload((prev) => ({ ...prev, progress })),
      });

      setForm((prev) => ({ ...prev, thumbnail_url: publicUrl }));
      setThumbnailUpload({ error: null, fileName: file.name, progress: 100, uploading: false });
      toast.success("Thumbnail uploaded successfully");
    } catch (error) {
      const message = normaliseUploadError(error, "thumbnail");
      setThumbnailUpload({ error: message, fileName: file.name, progress: 0, uploading: false });
      toast.error(message);
    } finally {
      if (thumbnailRef.current) thumbnailRef.current.value = "";
    }
  };

  const uploadBusy = videoUpload.uploading || thumbnailUpload.uploading;

  return (
    <div className="space-y-4">
      <div className="glass-card p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-heading font-semibold sm:text-base">
              <GraduationCap size={16} className="text-primary" /> Nevorai Academy
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              Manage tutorial videos with direct uploads, thumbnail images, and cleaner lesson cards.
            </p>
          </div>
          {!showForm && (
            <Button
              size="sm"
              variant="hero"
              className="min-h-[40px] text-xs"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus size={14} /> New tutorial
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mt-4 space-y-5 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold sm:text-base">{editing ? "Edit tutorial" : "New tutorial"}</h3>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  Upload the video first, add a thumbnail image, then save the lesson.
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={resetForm} aria-label="Close form">
                <X size={16} />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. How to upload your first video"
                  className="mt-1.5 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger className="mt-1.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div>
                  <Label className="text-xs">Published</Label>
                  <p className="text-[10px] text-muted-foreground">Visible to users immediately</p>
                </div>
                <Switch
                  checked={form.is_published}
                  onCheckedChange={(value) => setForm({ ...form, is_published: value })}
                />
              </div>

              <div className="sm:col-span-2 space-y-2 rounded-xl border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Label className="text-xs">Video file *</Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Primary action: upload the tutorial video here.
                    </p>
                  </div>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={videoUpload.uploading}
                    onClick={() => videoRef.current?.click()}
                  >
                    {videoUpload.uploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Uploading video…
                      </>
                    ) : (
                      <>
                        <Upload size={14} /> Upload video file
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Video size={16} className="text-primary" />
                    {videoUpload.fileName || form.video_url ? "Video selected" : "No video uploaded yet"}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {videoUpload.fileName
                      ? `${videoUpload.fileName}${videoUpload.progress === 100 ? " — upload complete" : ""}`
                      : "MP4/WebM/MOV supported. Large uploads now show live progress."}
                  </p>

                  {(videoUpload.uploading || videoUpload.progress > 0) && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{videoUpload.uploading ? "Uploading" : "Ready"}</span>
                        <span>{videoUpload.progress}%</span>
                      </div>
                      <Progress value={videoUpload.progress} className="h-2" />
                    </div>
                  )}

                  {form.video_url && !videoUpload.uploading && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                      <CheckCircle2 size={14} className="text-primary" />
                      <span className="truncate">{form.video_url}</span>
                    </div>
                  )}

                  {videoUpload.error && (
                    <p className="mt-3 text-[11px] text-destructive">{videoUpload.error}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Or paste a direct video URL</Label>
                <Input
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  placeholder="https://... or YouTube/Vimeo embed URL"
                  className="mt-1.5 text-sm"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 rounded-xl border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Label className="text-xs">Thumbnail image</Label>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Upload a cover image instead of pasting a thumbnail URL.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {form.thumbnail_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => setForm((prev) => ({ ...prev, thumbnail_url: "" }))}
                      >
                        Remove
                      </Button>
                    )}
                    <input
                      ref={thumbnailRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={thumbnailUpload.uploading}
                      onClick={() => thumbnailRef.current?.click()}
                    >
                      {thumbnailUpload.uploading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Uploading image…
                        </>
                      ) : (
                        <>
                          <ImagePlus size={14} /> Upload thumbnail
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {(thumbnailUpload.uploading || thumbnailUpload.progress > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{thumbnailUpload.fileName || "Thumbnail"}</span>
                      <span>{thumbnailUpload.progress}%</span>
                    </div>
                    <Progress value={thumbnailUpload.progress} className="h-2" />
                  </div>
                )}

                {thumbnailUpload.error && (
                  <p className="text-[11px] text-destructive">{thumbnailUpload.error}</p>
                )}

                {form.thumbnail_url ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="aspect-video w-full bg-muted">
                      <img
                        src={form.thumbnail_url}
                        alt="Tutorial thumbnail preview"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                      Thumbnail ready for this tutorial card.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-[11px] text-muted-foreground">
                    No thumbnail uploaded yet.
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="mt-1.5 text-sm"
                  placeholder="Short summary shown on the tutorial card"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || uploadBusy || !form.title.trim() || !form.video_url.trim()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save tutorial
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 animate-spin" /> Loading tutorials…
        </div>
      ) : (
        byCategory.map((cat) => (
          <div key={cat.value} className="glass-card p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{cat.label}</h3>
              <span className="text-[10px] text-muted-foreground">{cat.items.length} videos</span>
            </div>
            {cat.items.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No tutorials yet.</p>
            ) : (
              <ul className="space-y-2">
                {cat.items.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-2">
                    <span className="w-6 text-center text-xs font-mono text-muted-foreground">{i + 1}</span>
                    {t.thumbnail_url ? (
                      <img
                        src={t.thumbnail_url}
                        alt={t.title}
                        className="h-10 w-16 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-10 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
                        <Video size={14} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        {!t.is_published && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase">Draft</span>}
                      </div>
                      {t.description && <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={i === 0}
                        onClick={() => reorderMutation.mutate({ id: t.id, dir: "up", category: t.category })}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={i === cat.items.length - 1}
                        onClick={() => reorderMutation.mutate({ id: t.id, dir: "down", category: t.category })}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${t.title}"?`)) deleteMutation.mutate(t.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AcademyTab;
