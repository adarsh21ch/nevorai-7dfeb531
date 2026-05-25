import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Play, FileText, Video, Image, GraduationCap, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Common intent keys the bot uses to look up media
const SUGGESTED_KEYS = [
  { key: "demo_video", label: "Demo video (when user asks 'show demo')" },
  { key: "brochure", label: "Brochure / product PDF" },
  { key: "welcome_image", label: "Welcome image" },
  { key: "upload_help", label: "How to upload a video tutorial" },
  { key: "create_funnel", label: "How to create a funnel" },
  { key: "skip_endout", label: "How to skip / end out a step" },
  { key: "lead_capture_help", label: "Setting up lead capture" },
  { key: "landing_page_help", label: "Building a landing page" },
  { key: "billing_help", label: "Billing and pricing" },
  { key: "whatsapp_setup_help", label: "Connecting WhatsApp automation" },
];

interface AcademyTutorial {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  duration_seconds: number;
  is_published: boolean;
}

interface Media {
  id: string;
  key: string;
  label: string;
  type: "video" | "image" | "document" | "audio";
  url: string;
  caption: string | null;
  filename: string | null;
  is_active: boolean;
  created_at: string;
}

export function WhatsAppMediaTab() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: media, isLoading: mediaLoading } = useQuery({
    queryKey: ["whatsapp_media"],
    queryFn: async (): Promise<Media[]> => {
      const { data } = await supabase
        .from("whatsapp_media" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as unknown as Media[];
    },
  });

  const { data: tutorials } = useQuery({
    queryKey: ["academy_tutorials_for_whatsapp"],
    queryFn: async (): Promise<AcademyTutorial[]> => {
      const { data } = await supabase
        .from("academy_tutorials" as any)
        .select("*")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      return (data || []) as unknown as AcademyTutorial[];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this media mapping? The bot will stop sending it for that intent.")) return;
    try {
      await supabase.from("whatsapp_media" as any).delete().eq("id", id);
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["whatsapp_media"] });
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const handleToggleActive = async (m: Media) => {
    try {
      await supabase
        .from("whatsapp_media" as any)
        .update({ is_active: !m.is_active })
        .eq("id", m.id);
      qc.invalidateQueries({ queryKey: ["whatsapp_media"] });
    } catch (e) {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">WhatsApp Media Library</h3>
          <p className="text-sm text-muted-foreground">
            Map videos & documents to bot intent keys. The bot sends these when users ask matching questions.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add media
            </Button>
          </DialogTrigger>
          <AddMediaDialog
            tutorials={tutorials || []}
            onDone={() => {
              setAddOpen(false);
              qc.invalidateQueries({ queryKey: ["whatsapp_media"] });
            }}
          />
        </Dialog>
      </div>

      {mediaLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !media || media.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No media mapped yet.</p>
            <p className="text-xs mt-1">Add your first one to let the bot send videos and PDFs over WhatsApp.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Intent key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {media.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize gap-1">
                      {m.type === "video" && <Video className="h-3 w-3" />}
                      {m.type === "image" && <Image className="h-3 w-3" />}
                      {m.type === "document" && <FileText className="h-3 w-3" />}
                      {m.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs font-mono">{m.key}</code>
                  </TableCell>
                  <TableCell className="text-sm">{m.label}</TableCell>
                  <TableCell>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 inline-flex items-center gap-1 max-w-[200px] truncate"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{m.url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={m.is_active ? "default" : "outline"}
                      onClick={() => handleToggleActive(m)}
                    >
                      {m.is_active ? "On" : "Off"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AddMediaDialog({
  tutorials,
  onDone,
}: {
  tutorials: AcademyTutorial[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState("academy");

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add WhatsApp media</DialogTitle>
      </DialogHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="academy">
            <GraduationCap className="h-4 w-4 mr-2" />
            From Academy
          </TabsTrigger>
          <TabsTrigger value="url">
            <ExternalLink className="h-4 w-4 mr-2" />
            By URL
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="academy" className="mt-4">
          <AcademyPicker tutorials={tutorials} onDone={onDone} />
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <UrlForm onDone={onDone} />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <UploadForm onDone={onDone} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

function AcademyPicker({
  tutorials,
  onDone,
}: {
  tutorials: AcademyTutorial[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<AcademyTutorial | null>(null);
  const [intentKey, setIntentKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected || !intentKey) {
      toast.error("Pick a tutorial and an intent key");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("whatsapp_media" as any).upsert(
        {
          key: intentKey,
          label: selected.title,
          type: "video",
          url: selected.video_url,
          caption: selected.description?.slice(0, 1024) || selected.title,
          is_active: true,
        },
        { onConflict: "key" },
      );
      toast.success("Linked academy tutorial to intent");
      onDone();
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (tutorials.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No published academy tutorials yet. Add some in <code>Settings → Academy</code> first.
      </div>
    );
  }

  // Group by category
  const byCategory = new Map<string, AcademyTutorial[]>();
  for (const t of tutorials) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Intent key (when bot should send this video)</Label>
        <Select value={intentKey} onValueChange={setIntentKey}>
          <SelectTrigger>
            <SelectValue placeholder="Choose intent key..." />
          </SelectTrigger>
          <SelectContent>
            {SUGGESTED_KEYS.map((k) => (
              <SelectItem key={k.key} value={k.key}>
                <span className="font-mono text-xs">{k.key}</span>
                <span className="text-muted-foreground ml-2">— {k.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        {[...byCategory.entries()].map(([category, tuts]) => (
          <div key={category}>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3 mb-1">
              {category.replace(/-/g, " ")}
            </div>
            {tuts.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left p-2 rounded border transition flex gap-3 items-start ${
                  selected?.id === t.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {t.thumbnail_url ? (
                  <img
                    src={t.thumbnail_url}
                    alt=""
                    className="w-16 h-10 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="w-16 h-10 bg-muted rounded shrink-0 flex items-center justify-center">
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                  )}
                  {t.duration_seconds > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {Math.floor(t.duration_seconds / 60)}:{(t.duration_seconds % 60).toString().padStart(2, "0")}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving || !selected || !intentKey} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Link to WhatsApp bot
      </Button>
    </div>
  );
}

function UrlForm({ onDone }: { onDone: () => void }) {
  const [intentKey, setIntentKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"video" | "image" | "document">("video");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!intentKey || !url || !label) {
      toast.error("Fill intent key, label, and URL");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("whatsapp_media" as any).upsert(
        {
          key: intentKey,
          label,
          type,
          url,
          caption: caption || null,
          filename: type === "document" ? (filename || "document.pdf") : null,
          is_active: true,
        },
        { onConflict: "key" },
      );
      toast.success("Saved");
      onDone();
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Intent key</Label>
        <Select value={intentKey} onValueChange={setIntentKey}>
          <SelectTrigger>
            <SelectValue placeholder="Choose intent key..." />
          </SelectTrigger>
          <SelectContent>
            {SUGGESTED_KEYS.map((k) => (
              <SelectItem key={k.key} value={k.key}>{k.key}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Label (shown in admin only)</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nevorai demo video" />
      </div>

      <div className="space-y-1">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="document">Document (PDF)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Public URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>

      {type === "document" && (
        <div className="space-y-1">
          <Label>File name shown to user</Label>
          <Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Nevorai-Brochure.pdf" />
        </div>
      )}

      <div className="space-y-1">
        <Label>Caption (optional)</Label>
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Quick walkthrough of Nevorai..." />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save
      </Button>
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const [intentKey, setIntentKey] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !intentKey || !label) {
      toast.error("Pick a file, intent key, and label");
      return;
    }
    setUploading(true);
    try {
      // Upload to whatsapp-media bucket (must be public)
      const ext = file.name.split(".").pop() || "bin";
      const path = `${intentKey}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}. Make sure the 'whatsapp-media' bucket exists and is public.`);
        return;
      }

      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const type: "video" | "image" | "document" = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("image/")
        ? "image"
        : "document";

      await supabase.from("whatsapp_media" as any).upsert(
        {
          key: intentKey,
          label,
          type,
          url: publicUrl,
          caption: label,
          filename: type === "document" ? file.name : null,
          mime_type: file.type,
          is_active: true,
        },
        { onConflict: "key" },
      );

      toast.success("Uploaded and saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message || "Failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Intent key</Label>
        <Select value={intentKey} onValueChange={setIntentKey}>
          <SelectTrigger>
            <SelectValue placeholder="Choose intent key..." />
          </SelectTrigger>
          <SelectContent>
            {SUGGESTED_KEYS.map((k) => (
              <SelectItem key={k.key} value={k.key}>{k.key}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nevorai demo video" />
      </div>

      <div className="space-y-1">
        <Label>File</Label>
        <Input
          type="file"
          accept="video/*,image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <p className="text-xs text-muted-foreground">
          Max 16 MB for videos / 5 MB for images via Meta. Make sure your <code>whatsapp-media</code> Supabase Storage bucket is public.
        </p>
      </div>

      <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
        {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Upload & save
      </Button>
    </div>
  );
}
