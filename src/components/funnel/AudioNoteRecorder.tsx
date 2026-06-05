import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Upload, Square, Play, Pause, Trash2, Loader2, AudioLines } from "lucide-react";
import { toast } from "sonner";

interface AudioNoteRecorderProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  maxSizeMB?: number;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export const AudioNoteRecorder = ({
  value,
  onChange,
  bucket = "landing-page-assets",
  folder = "audio-notes",
  maxSizeMB = 10,
}: AudioNoteRecorderProps) => {
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const uploadBlob = async (blob: Blob, ext: string) => {
    if (blob.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Audio must be under ${maxSizeMB}MB`);
      return;
    }
    setUploading(true);
    try {
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, { cacheControl: "31536000", upsert: false, contentType: blob.type || `audio/${ext}` });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(publicUrl);
      toast.success("Audio saved");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    await uploadBlob(file, ext);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await uploadBlob(blob, "webm");
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= 300) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
  };

  const remove = () => {
    onChange("");
    setPlaying(false);
    setProgress(0);
  };

  // ---------- UI ----------
  if (value) {
    return (
      <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/60 to-muted/20 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
          >
            {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <AudioLines size={14} className="text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audio Note</span>
            </div>
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1 font-mono">
              <span>{formatTime((progress / 100) * duration)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={remove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 size={16} />
          </Button>
        </div>
        <audio
          ref={audioRef}
          src={value}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
          onTimeUpdate={(e) => {
            const a = e.target as HTMLAudioElement;
            if (a.duration) setProgress((a.currentTime / a.duration) * 100);
          }}
          className="hidden"
        />
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex-1">
            <Upload size={13} className="mr-1.5" /> Replace
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={startRecording} disabled={uploading || recording} className="flex-1">
            <Mic size={13} className="mr-1.5" /> Re-record
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />
      </div>
    );
  }

  if (recording) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background p-6 text-center space-y-4">
        <div className="relative inline-flex">
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <div className="relative h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl">
            <Mic size={26} />
          </div>
        </div>
        <div>
          <div className="text-2xl font-mono font-semibold tracking-wider">{formatTime(elapsed)}</div>
          <p className="text-xs text-muted-foreground mt-1">Recording… speak clearly into your mic</p>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={stopRecording} className="rounded-full px-5">
          <Square size={13} className="mr-1.5 fill-current" /> Stop & Save
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30 p-6">
      <div className="flex flex-col items-center text-center gap-2 mb-5">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <AudioLines size={22} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Add a personal audio note</p>
          <p className="text-xs text-muted-foreground mt-0.5">Record from your mic or upload from your device · max {maxSizeMB}MB</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={startRecording}
          disabled={uploading}
          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all p-4 disabled:opacity-50"
        >
          <Mic size={20} className="group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Record</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all p-4 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} className="group-hover:scale-110 transition-transform" />}
          <span className="text-xs font-semibold">{uploading ? "Uploading…" : "Upload"}</span>
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="audio/*,audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/m4a" onChange={handleFile} className="hidden" />
    </div>
  );
};
