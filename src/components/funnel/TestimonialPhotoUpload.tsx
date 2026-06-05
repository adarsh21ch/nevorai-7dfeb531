import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, IMAGE_PRESETS, LONG_CACHE_CONTROL } from "@/lib/imageCompress";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface TestimonialPhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  landingPageId: string;
  testimonialId: string;
  studentName?: string;
  maxSizeMB?: number;
}

export const TestimonialPhotoUpload = ({
  value, onChange, landingPageId, testimonialId, studentName, maxSizeMB = 5,
}: TestimonialPhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const initials = (studentName || "?").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) { toast.error(`Photo must be under ${maxSizeMB}MB`); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setScale(1); setOffset({ x: 0, y: 0 }); setCropOpen(true); };
    reader.onerror = () => toast.error("Could not read the selected image");
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 280;
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (imgAspect > 1) { drawH = size * scale; drawW = drawH * imgAspect; }
    else { drawW = size * scale; drawH = drawW / imgAspect; }

    const drawX = (size - drawW) / 2 + offset.x;
    const drawY = (size - drawH) / 2 + offset.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "hsl(var(--primary))"; ctx.lineWidth = 3; ctx.stroke();
  }, [offset.x, offset.y, scale]);

  useEffect(() => {
    if (!cropOpen || !rawImage) return;
    const img = new Image();
    img.onload = () => { imgRef.current = img; drawPreview(); };
    img.src = rawImage;
  }, [cropOpen, drawPreview, rawImage]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  const handleConfirmCrop = async () => {
    const img = imgRef.current;
    if (!img) return;
    setUploading(true);
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = 400; exportCanvas.height = 400;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the photo.");

      const size = 400;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();

      const imgAspect = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number;
      if (imgAspect > 1) { drawH = size * scale; drawW = drawH * imgAspect; }
      else { drawW = size * scale; drawH = drawW / imgAspect; }

      const ratio = size / 280;
      const drawX = (size - drawW) / 2 + offset.x * ratio;
      const drawY = (size - drawH) / 2 + offset.y * ratio;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Could not create cropped photo."));
        }, "image/jpeg", 0.9);
      });
      // Shrink to WebP at TESTIMONIAL_PHOTO budget for fast loads + cache hits.
      const blob = await compressImage(rawBlob, IMAGE_PRESETS.TESTIMONIAL_PHOTO);

      const path = `testimonial-photos/${landingPageId}/${testimonialId}-${Date.now()}.webp`;
      const { error } = await supabase.storage.from("landing-page-assets")
        .upload(path, blob, { cacheControl: LONG_CACHE_CONTROL, upsert: false, contentType: "image/webp" });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("landing-page-assets").getPublicUrl(path);
      onChange(publicUrl);
      setCropOpen(false); setRawImage(null);
      toast.success("Photo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/60 hover:bg-muted"
        >
          {value ? (
            <img src={value} alt={studentName || "Student photo"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials || <Camera size={18} />}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={18} className="text-foreground" />
          </div>
        </button>

        <div className="flex flex-wrap items-center justify-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => inputRef.current?.click()}>
            {value ? "Change" : "Upload"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-destructive hover:text-destructive" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-center text-[10px] text-muted-foreground">Circle crop • JPG/PNG/WebP</p>
      </div>

      <Dialog open={cropOpen} onOpenChange={(open) => { if (!open) { setCropOpen(false); setRawImage(null); } }}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <DialogHeader><DialogTitle className="font-heading">Crop student photo</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-center text-xs text-muted-foreground">Drag to position the face and zoom to fit the circle.</p>
            <div
              className="cursor-grab overflow-hidden rounded-full bg-muted active:cursor-grabbing"
              style={{ width: 280, height: 280, touchAction: "none" }}
              onMouseDown={(e) => { setDragging(true); setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }}
              onMouseMove={(e) => { if (!dragging) return; setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onTouchStart={(e) => { const t = e.touches[0]; setDragging(true); setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y }); }}
              onTouchMove={(e) => { if (!dragging) return; const t = e.touches[0]; setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y }); }}
              onTouchEnd={() => setDragging(false)}
            >
              <canvas ref={canvasRef} width={280} height={280} className="h-[280px] w-[280px]" />
            </div>
            <div className="flex w-full max-w-[280px] items-center gap-3">
              <span className="shrink-0 text-xs text-muted-foreground">Zoom</span>
              <Slider value={[scale]} min={1} max={3} step={0.05} onValueChange={([next]) => setScale(next)} className="flex-1" />
            </div>
            <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
              <RotateCcw size={12} className="mr-1" /> Reset
            </Button>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={uploading} onClick={() => { setCropOpen(false); setRawImage(null); }}>Cancel</Button>
            <Button type="button" disabled={uploading} onClick={handleConfirmCrop}>
              {uploading ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Uploading...</> : <><Check size={14} className="mr-1.5" /> Save photo</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
