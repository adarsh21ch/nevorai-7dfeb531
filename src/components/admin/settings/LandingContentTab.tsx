import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImageIcon, Upload, Loader2, Save } from "lucide-react";
import { AnimatedImage, type AnimationKind } from "@/components/landing/AnimatedImage";
import type { LandingSlot } from "@/hooks/useLandingContent";

const ANIMATIONS: { value: AnimationKind; label: string }[] = [
  { value: "fade-up",    label: "Fade up (default)" },
  { value: "ken-burns",  label: "Ken-Burns drift" },
  { value: "parallax",   label: "Parallax scroll" },
  { value: "zoom-hover", label: "Zoom on hover" },
];

const SECTION_LABELS: Record<string, string> = {
  story: "Story sections (problem ↔ solution)",
  compare: "Comparison: YouTube vs Nevorai",
};

interface SlotCardProps {
  slot: LandingSlot;
  onSaved: () => void;
}

const SlotCard = ({ slot, onSaved }: SlotCardProps) => {
  const [title, setTitle] = useState(slot.title ?? "");
  const [subtitle, setSubtitle] = useState(slot.subtitle ?? "");
  const [bulletsText, setBulletsText] = useState((slot.bullets ?? []).join("\n"));
  const [animation, setAnimation] = useState<AnimationKind>(slot.animation);
  const [imageUrl, setImageUrl] = useState(slot.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(slot.title ?? "");
    setSubtitle(slot.subtitle ?? "");
    setBulletsText((slot.bullets ?? []).join("\n"));
    setAnimation(slot.animation);
    setImageUrl(slot.image_url ?? "");
  }, [slot.id]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      // Shrink to WebP ≤1200px before upload, and serve with a 1-year cache.
      const { compressImage, IMAGE_PRESETS, LONG_CACHE_CONTROL, withWebpExtension } = await import("@/lib/imageCompress");
      const blob = await compressImage(file, IMAGE_PRESETS.LANDING_IMAGE);
      const ext = file.name.split(".").pop() || "jpg";
      const rawPath = `${slot.id}-${Date.now()}.${ext}`;
      const path = blob.type === "image/webp" ? withWebpExtension(rawPath) : rawPath;
      const { error } = await supabase.storage
        .from("landing-images")
        .upload(path, blob, {
          upsert: true,
          contentType: blob.type || file.type,
          cacheControl: LONG_CACHE_CONTROL,
        });
      if (error) throw error;
      const { data } = supabase.storage.from("landing-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Image uploaded — click Save to apply");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const bullets = bulletsText.split("\n").map((b) => b.trim()).filter(Boolean);
      const { error } = await (supabase as any)
        .from("landing_content")
        .update({
          title,
          subtitle,
          bullets,
          animation,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-3 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{slot.id}</p>
          <p className="text-xs sm:text-sm font-medium truncate">{title || "(no title)"}</p>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl overflow-hidden bg-black/40">
        {imageUrl ? (
          <AnimatedImage src={imageUrl} alt={title} animation={animation} />
        ) : (
          <div className="aspect-[16/10] flex items-center justify-center text-muted-foreground text-xs">
            <ImageIcon className="mr-2 h-4 w-4" /> Using bundled fallback image
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.currentTarget.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {imageUrl ? "Replace image" : "Upload image"}
        </Button>
        {imageUrl && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setImageUrl("")}>
            Clear (use fallback)
          </Button>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input className="mt-1 text-sm bg-muted border-border" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Subtitle</Label>
          <Textarea className="mt-1 text-sm bg-muted border-border" rows={2} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">
            {slot.section === "compare" ? "Bullet points (one per line)" : "Metric / highlight (optional, one per line — first line shown)"}
          </Label>
          <Textarea className="mt-1 text-sm bg-muted border-border font-mono" rows={3} value={bulletsText} onChange={(e) => setBulletsText(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Image animation</Label>
          <Select value={animation} onValueChange={(v) => setAnimation(v as AnimationKind)}>
            <SelectTrigger className="mt-1 text-sm bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANIMATIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button variant="hero" size="sm" className="w-full" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </Button>
    </div>
  );
};

export const LandingContentTab = () => {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-landing-content"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("landing_content")
        .select("*")
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // compare.combined is legacy/unused — the comparison section now uses
      // compare.youtube + compare.nevorai with a toggle.
      return ((data ?? []) as LandingSlot[]).filter(
        (s) => s.id !== "compare.combined",
      );
    },
  });

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["admin-landing-content"] });
    qc.invalidateQueries({ queryKey: ["landing-content"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card p-4 text-sm text-destructive">
        Couldn't load landing content. Make sure the <code>landing_content</code> table exists (run the migration SQL).
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-card p-4 text-sm">
        No landing slots seeded yet. Run the migration SQL from <code>landing_content_migration.sql</code>.
      </div>
    );
  }

  const grouped = data.reduce<Record<string, LandingSlot[]>>((acc, s) => {
    (acc[s.section] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-heading font-semibold sm:text-base">Landing page content</h2>
        <p className="text-[11px] text-muted-foreground sm:text-xs mt-1">
          Replace any image, edit titles/subtitles, and pick an animation. Public landing page updates within ~5 minutes (or instantly after a hard refresh).
        </p>
      </div>

      {Object.entries(grouped).map(([section, slots]) => (
        <div key={section} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {SECTION_LABELS[section] ?? section}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onSaved={onSaved} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
