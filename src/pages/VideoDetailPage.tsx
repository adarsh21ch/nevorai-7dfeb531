import { useState } from "react";
import { useParams, useNavigate, Link } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video as VideoIcon, Copy, ExternalLink, ArrowLeft, Eye,
  Layers, FileText, Radio, Save, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type AnyVideo = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  public_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: string | null;
  view_count: number | null;
  is_shared: boolean | null;
  allow_copy_link: boolean | null;
  allow_seek?: boolean | null;
  allow_playback_speed?: boolean | null;
  created_at: string | null;
};

const VideoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  useDocumentTitle("Video details");

  const { data: video, isLoading } = useQuery({
    queryKey: ["video-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as AnyVideo | null;
    },
    enabled: !!id,
  });

  // Usage: where this video is referenced
  const { data: usage } = useQuery({
    queryKey: ["video-usage", id],
    queryFn: async () => {
      const [funnelsRes, lpRes, liveRes] = await Promise.all([
        supabase.from("funnels").select("id, title, is_published").eq("video_asset_id", id!),
        supabase.from("landing_pages").select("id, title, status").eq("post_submit_video_asset_id", id!),
        supabase.from("live_sessions").select("id, title, status").eq("video_asset_id", id!),
      ]);
      return {
        funnels: (funnelsRes.data || []) as Array<{ id: string; title: string; is_published: boolean | null }>,
        landingPages: (lpRes.data || []) as Array<{ id: string; title: string; status: string | null }>,
        liveSessions: (liveRes.data || []) as Array<{ id: string; title: string; status: string | null }>,
      };
    },
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowCopyLink, setAllowCopyLink] = useState(true);
  const [isShared, setIsShared] = useState(true);
  const [allowSeek, setAllowSeek] = useState(true);
  const [allowSpeed, setAllowSpeed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  if (video && !hydrated) {
    setTitle(video.title || "");
    setDescription(video.description || "");
    setAllowCopyLink(video.allow_copy_link ?? true);
    setIsShared(video.is_shared ?? true);
    setAllowSeek(video.allow_seek ?? true);
    setAllowSpeed(video.allow_playback_speed ?? true);
    setHydrated(true);
  }

  const isOwner = !!user && !!video && user.id === video.owner_id;
  const publicUrl = typeof window !== "undefined" && id ? `${window.location.origin}/v/${id}` : "";

  const detailsMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        description: description || null,
        allow_copy_link: allowCopyLink,
        is_shared: isShared,
      };
      // Only include the new flags if they exist on the row (post-migration).
      if (video && "allow_seek" in video) payload.allow_seek = allowSeek;
      if (video && "allow_playback_speed" in video) payload.allow_playback_speed = allowSpeed;
      const { error } = await supabase.from("video_assets").update(payload).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Video updated");
      qc.invalidateQueries({ queryKey: ["video-detail", id] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not save"),
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Public link copied");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      </DashboardLayout>
    );
  }

  if (!video) {
    return (
      <DashboardLayout>
        <div className="premium-card p-10 text-center">
          <VideoIcon size={36} className="mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-lg font-heading font-semibold">Video not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
          <Link to="/videos"><Button variant="outline" className="mt-4">Back to Videos</Button></Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!isOwner) {
    return (
      <DashboardLayout>
        <div className="premium-card p-10 text-center">
          <h2 className="text-lg font-heading font-semibold">You don't have access to edit this video</h2>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="mt-4"><ExternalLink size={14} /> Open public page</Button>
          </a>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate("/videos")} className="rounded-md p-1.5 hover:bg-muted">
              <ArrowLeft size={18} />
            </button>
            <h1 className="truncate text-xl font-heading font-bold sm:text-2xl">{video.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}><Copy size={14} /> Copy Link</Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink size={14} /> Open</Button>
            </a>
          </div>
        </div>

        {/* Preview */}
        <div className="premium-card overflow-hidden">
          <div className="relative aspect-video w-full bg-muted">
            {video.public_url ? (
              <video
                src={video.public_url}
                controls
                playsInline
                preload="metadata"
                poster={video.thumbnail_url || undefined}
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <VideoIcon size={32} className="text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* DETAILS */}
          <TabsContent value="details" className="space-y-4">
            <div className="premium-card space-y-4 p-4 sm:p-6">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 bg-muted border-border" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1.5 bg-muted border-border resize-none"
                  placeholder="Describe what this video is about (optional)"
                />
              </div>
              <div>
                <Label>Public link</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input readOnly value={publicUrl} className="bg-muted border-border" />
                  <Button variant="outline" size="icon" onClick={copyLink}><Copy size={14} /></Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="hero" onClick={() => detailsMutation.mutate()} disabled={detailsMutation.isPending}>
                  {detailsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save changes
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ANALYTICS — only real, stored numbers. No fabricated retention. */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="premium-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground"><Eye size={14} /><span className="text-[11px] font-semibold uppercase tracking-wider">Total views</span></div>
                <p className="mt-1 text-2xl font-heading font-extrabold">{(video.view_count || 0).toLocaleString()}</p>
              </div>
              <div className="premium-card p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
                <p className="mt-1 text-sm font-medium capitalize">{video.status || "—"}</p>
              </div>
              <div className="premium-card p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Uploaded</div>
                <p className="mt-1 text-sm font-medium">{video.created_at ? new Date(video.created_at).toLocaleDateString() : "—"}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">More analytics coming soon. We only show metrics we actually track.</p>
          </TabsContent>

          {/* USAGE */}
          <TabsContent value="usage" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to={`/funnels/create?videoId=${video.id}`}>
                <Button variant="outline" className="w-full justify-start"><Layers size={14} /> Use in Funnel</Button>
              </Link>
              <Link to={`/landing-pages/create?videoId=${video.id}`}>
                <Button variant="outline" className="w-full justify-start"><FileText size={14} /> Use in Landing Page</Button>
              </Link>
              <Link to={`/live?videoId=${video.id}`}>
                <Button variant="outline" className="w-full justify-start"><Radio size={14} /> Use in Live Session</Button>
              </Link>
            </div>

            <UsageList title="Funnels using this video" icon={Layers} items={usage?.funnels.map((f) => ({ id: f.id, title: f.title, badge: f.is_published ? "Published" : "Draft", href: `/funnels/${f.id}` })) || []} emptyHint="Not used in any funnel yet." />
            <UsageList title="Landing pages using this video" icon={FileText} items={usage?.landingPages.map((p) => ({ id: p.id, title: p.title, badge: p.status === "published" ? "Published" : (p.status || "Draft"), href: `/landing-pages/${p.id}` })) || []} emptyHint="Not used in any landing page yet." />
            <UsageList title="Live sessions using this video" icon={Radio} items={usage?.liveSessions.map((s) => ({ id: s.id, title: s.title, badge: s.status || "scheduled", href: `/live/${s.id}` })) || []} emptyHint="Not used in any live session yet." />
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
            <div className="premium-card divide-y divide-border">
              <SettingRow
                title="Public visibility"
                desc="Allow anyone with the link to watch."
                checked={isShared}
                onChange={setIsShared}
              />
              <SettingRow
                title="Allow others to reuse this video"
                desc="Public viewers see a 'Copy nFlow Link' button."
                checked={allowCopyLink}
                onChange={setAllowCopyLink}
              />
              <SettingRow
                title="Allow forward seeking"
                desc="When off, viewers cannot skip ahead in the player."
                checked={allowSeek}
                onChange={setAllowSeek}
              />
              <SettingRow
                title="Allow playback speed change"
                desc="When off, the speed control is hidden."
                checked={allowSpeed}
                onChange={setAllowSpeed}
              />
            </div>
            <div className="flex justify-end">
              <Button variant="hero" onClick={() => detailsMutation.mutate()} disabled={detailsMutation.isPending}>
                {detailsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save settings
              </Button>
            </div>
            {!("allow_seek" in (video as any)) && (
              <p className="text-xs text-warning">
                Tip: forward-seek and playback-speed controls require a one-time database migration. They'll be saved silently for now.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const SettingRow = ({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4 p-4">
    <div className="min-w-0">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const UsageList = ({
  title, icon: Icon, items, emptyHint,
}: { title: string; icon: any; items: Array<{ id: string; title: string; badge: string; href: string }>; emptyHint: string }) => (
  <div className="premium-card p-4">
    <div className="mb-3 flex items-center gap-2 text-sm font-heading font-semibold"><Icon size={14} /> {title}</div>
    {items.length === 0 ? (
      <p className="text-xs text-muted-foreground">{emptyHint}</p>
    ) : (
      <div className="space-y-2">
        {items.map((it) => (
          <Link key={it.id} to={it.href as any} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/50">
            <span className="truncate text-sm">{it.title}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{it.badge}</span>
          </Link>
        ))}
      </div>
    )}
  </div>
);

export default VideoDetailPage;
