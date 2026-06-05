import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { compressImage, IMAGE_PRESETS, LONG_CACHE_CONTROL } from "@/lib/imageCompress";
import { Upload, X, Loader2, Camera, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface SpeakerPhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export const SpeakerPhotoUpload = ({ value, onChange }: SpeakerPhotoUploadProps) => {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setCropOpen(true);
    };
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
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawW: number, drawH: number;
    if (imgAspect > 1) {
      drawH = size * scale;
      drawW = drawH * imgAspect;
    } else {
      drawW = size * scale;
      drawH = drawW / imgAspect;
    }

    const drawX = (size - drawW) / 2 + offset.x;
    const drawY = (size - drawH) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [scale, offset]);

  useEffect(() => {
    if (cropOpen && rawImage) {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        drawPreview();
      };
      img.src = rawImage;
    }
  }, [rawImage, cropOpen, drawPreview]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const handleConfirmCrop = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setUploading(true);
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = 400;
      exportCanvas.height = 400;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas error");

      const img = imgRef.current!;
      const size = 400;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      const imgAspect = img.naturalWidth / img.naturalHeight;
      let drawW: number, drawH: number;
      if (imgAspect > 1) {
        drawH = size * scale;
        drawW = drawH * imgAspect;
      } else {
        drawW = size * scale;
        drawH = drawW / imgAspect;
      }
      const ratio = size / 280;
      const drawX = (size - drawW) / 2 + offset.x * ratio;
      const drawY = (size - drawH) / 2 + offset.y * ratio;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob((b) => b ? resolve(b) : reject(new Error("Blob error")), "image/jpeg", 0.9);
      });
      const blob = await compressImage(rawBlob, IMAGE_PRESETS.AVATAR);

      const fileName = `speakers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await supabase.storage
        .from("landing-page-assets")
        .upload(fileName, blob, { cacheControl: LONG_CACHE_CONTROL, upsert: false, contentType: "image/webp" });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("landing-page-assets")
        .getPublicUrl(fileName);

      onChange(publicUrl);
      setCropOpen(false);
      setRawImage(null);
      toast.success("Photo uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Speaker Photo</Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {value ? (
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30 shrink-0">
            <img src={value} alt="Speaker" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload size={13} className="mr-1.5" /> Change Photo
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange("")}>
              <X size={13} className="mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/50 hover:bg-muted transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
        >
          <Camera size={24} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Upload Photo</span>
          <span className="text-[10px] text-muted-foreground/70">JPG, PNG, WebP · Max 2MB</span>
        </button>
      )}

      <Dialog open={cropOpen} onOpenChange={(v) => { if (!v) { setCropOpen(false); setRawImage(null); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading">Crop & Position Photo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-xs text-muted-foreground">Drag to reposition · Use slider to zoom</p>
            <div
              className="rounded-full overflow-hidden cursor-grab active:cursor-grabbing bg-muted"
              style={{ width: 280, height: 280, touchAction: "none" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => setDragging(false)}
            >
              <canvas ref={canvasRef} width={280} height={280} className="w-[280px] h-[280px]" />
            </div>

            <div className="w-full max-w-[280px] flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Zoom</span>
              <Slider
                value={[scale]}
                min={1}
                max={3}
                step={0.05}
                onValueChange={([v]) => setScale(v)}
                className="flex-1"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
              className="text-xs text-muted-foreground"
            >
              <RotateCcw size={12} className="mr-1" /> Reset
            </Button>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setCropOpen(false); setRawImage(null); }} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCrop} disabled={uploading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {uploading ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Uploading...</> : <><Check size={14} className="mr-1.5" /> Confirm & Upload</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
