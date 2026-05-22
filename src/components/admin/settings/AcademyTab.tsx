import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Upload, Save, Pencil, X, Eye, EyeOff,
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

export const AcademyTab = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
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
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (!form.video_url.trim()) throw new Error("Video URL is required");
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
      } else {
        // append at end of category
        const max = Math.max(
          0,
          ...tutorials.filter((t) => t.category === form.category).map((t) => t.order_index),
        );
        const { error } = await (supabase as any)
          .from("academy_tutorials")
          .insert({ ...payload, order_index: max + 1 });
        if (error) throw error;
      }
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
      const a = list[idx], b = list[swap];
      await (supabase as any).from("academy_tutorials").update({ order_index: b.order_index }).eq("id", a.id);
      await (supabase as any).from("academy_tutorials").update({ order_index: a.order_index }).eq("id", b.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-tutorials-admin"] });
      qc.invalidateQueries({ queryKey: ["academy-tutorials-public"] });
    },
  });

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Video must be under 500MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("academy-videos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("academy-videos").getPublicUrl(path);
      setForm((f) => ({ ...f, video_url: data.publicUrl }));
      toast.success("Video uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    items: tutorials.filter((t) => t.category === c.value).sort((a, b) => a.order_index - b.order_index),
  }));

  return (
    <div className="space-y-4">
      <div className="glass-card p-3 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
              <GraduationCap size={16} className="text-primary" /> Nevorai Academy
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1 sm:text-xs">
              Manage tutorial videos. Reorder, rename, replace, or unpublish at any time.
            </p>
          </div>
          {!showForm && (
            <Button size="sm" variant="hero" className="min-h-[40px] text-xs" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={14} /> New tutorial
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{editing ? "Edit tutorial" : "New tutorial"}</h3>
              <Button size="icon" variant="ghost" onClick={resetForm}><X size={16} /></Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="text-xs">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. How to upload your first video" className="mt-1.5 text-sm" />
              </div>

              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1.5 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div>
                  <Label className="text-xs">Published</Label>
                  <p className="text-[10px] text-muted-foreground">Visible to users</p>
                </div>
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2} className="mt-1.5 text-sm" placeholder="Short summary shown on the card" />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Video *</Label>
                <div className="mt-1.5 flex flex-col gap-2">
                  <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                    placeholder="Paste an mp4/YouTube embed URL or upload below" className="text-sm" />
                  <div className="flex items-center gap-2">
                    <input ref={fileRef} type="file" accept="video/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    <Button type="button" size="sm" variant="outline" disabled={uploading}
                      onClick={() => fileRef.current?.click()} className="text-xs">
                      {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload video file</>}
                    </Button>
                    <span className="text-[10px] text-muted-foreground">MP4/WebM up to 500MB</span>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Thumbnail URL (optional)</Label>
                <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  placeholder="https://..." className="mt-1.5 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
              <Button variant="hero" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save</>}
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
              <p className="text-xs text-muted-foreground italic">No tutorials yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {cat.items.map((t, i) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-2">
                    <span className="w-6 text-center text-xs font-mono text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        {!t.is_published && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase">Draft</span>}
                      </div>
                      {t.description && <p className="line-clamp-1 text-[11px] text-muted-foreground">{t.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0}
                        onClick={() => reorderMutation.mutate({ id: t.id, dir: "up", category: t.category })}>
                        <ArrowUp size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === cat.items.length - 1}
                        onClick={() => reorderMutation.mutate({ id: t.id, dir: "down", category: t.category })}>
                        <ArrowDown size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => { if (confirm(`Delete "${t.title}"?`)) deleteMutation.mutate(t.id); }}>
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
