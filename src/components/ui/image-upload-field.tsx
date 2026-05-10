import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  helperText?: string;
  className?: string;
  accept?: string;
  maxSizeMB?: number;
}

export const ImageUploadField = ({
  label,
  value,
  onChange,
  bucket = "landing-page-assets",
  folder = "images",
  helperText,
  className = "",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  maxSizeMB = 5,
}: ImageUploadFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Image must be under ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => onChange("");

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium">{label}</Label>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}

      <input ref={inputRef} type="file" accept={accept} onChange={handleUpload} className="hidden" />

      {value ? (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted">
            <img
              src={value}
              alt={label}
              className="w-full h-40 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex-1">
              {uploading ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Uploading...</> : <><Upload size={14} className="mr-1.5" /> Change Image</>}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleRemove} className="text-destructive hover:text-destructive">
              <X size={14} className="mr-1" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/50 hover:bg-muted transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon size={24} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Upload Image</span>
              <span className="text-[10px] text-muted-foreground/70">JPG, PNG, WebP · Max {maxSizeMB}MB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
