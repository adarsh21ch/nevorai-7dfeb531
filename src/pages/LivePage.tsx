import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import {
  Radio, Plus, Calendar, Users, Clock, Eye, Copy, Trash2, Video, Globe, IndianRupee, X,
  Layers, ExternalLink, ChevronLeft, ChevronRight, Trash, MessageCircle, Pencil,
  Play, RotateCcw, CalendarRange, ListChecks, Repeat
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeModal } from "@/components/UpgradeModal";
import { computeSessionSlots, currentLiveSlot, nextSlot as nextSlotFn, sessionDurationSec } from "@/lib/liveSession";
import { VideoPickerModal } from "@/components/VideoPickerModal";
import { useConfirm } from "@/components/ui/confirm-dialog";

const generateSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "my-session";

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Hong_Kong",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "UTC",
];

type SessionType = "funnel_video" | "external_link";
type RepeatType = "once" | "daily" | "interval" | "custom";

interface FormState {
  title: string;
  description: string;
  session_type: SessionType;
  funnel_id: string | null;
  video_asset_id: string | null;
  video_duration_seconds: number | null;
  platform: string;
  meeting_url: string;
  scheduled_times: string[];
  timezone: string;
  duration_minutes: number;
  repeat_type: RepeatType;
  repeat_interval_hours: number;
  repeat_window_start: string;
  repeat_window_end: string;
  repeat_end_date: string;
  replay_enabled: boolean;
  replay_delay_minutes: number;
  replay_expires_hours: number | null;
  replay_per_slot: boolean;
  is_published: boolean;
  max_attendees: number | null;
  access_type: string;
  show_name: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_city: boolean;
  show_viewer_count: boolean;
  payment_amount: number;
  upi_id: string;
  payment_instructions: string;
}

const defaultDateTime = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = (): FormState => ({
  title: "", description: "", session_type: "funnel_video",
  funnel_id: null, video_asset_id: null, video_duration_seconds: null,
  platform: "zoom", meeting_url: "",
  scheduled_times: [defaultDateTime()],
  timezone: "Asia/Kolkata",
  duration_minutes: 60,
  repeat_type: "once",
  repeat_interval_hours: 4,
  repeat_window_start: "09:00",
  repeat_window_end: "21:00",
  repeat_end_date: "",
  replay_enabled: true,
  replay_delay_minutes: 0,
  replay_expires_hours: null,
  replay_per_slot: true,
  is_published: true,
  max_attendees: null,
  access_type: "public",
  show_name: true, show_phone: true, show_email: true, show_city: false,
  show_viewer_count: true,
  payment_amount: 0, upi_id: "", payment_instructions: "",
});

const formatDuration = (sec: number | null | undefined) => {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}m ${s}s`;
};

const isoToDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SessionStatusBadge = ({ session }: { session: any }) => {
  if (session.status === "cancelled") {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 line-through">CANCELLED</span>;
  }
  if (session.is_published === false) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">UNPUBLISHED</span>;
  }
  if (session.session_type === "funnel_video") {
    if (currentLiveSlot(session)) {
      return (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 inline-flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          LIVE
        </span>
      );
    }
    if (nextSlotFn(session)) {
      return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500">SCHEDULED</span>;
    }
    if (session.replay_enabled) {
      return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">REPLAY</span>;
    }
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">ENDED</span>;
  }
  const cls: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-500/15 text-blue-500",
    live: "bg-red-500/15 text-red-500",
    ended: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls[session.status] || cls.draft}`}>
      {(session.status || "draft").toUpperCase()}
    </span>
  );
};

const RepeatBadge = ({ session }: { session: any }) => {
  const t = session.repeat_type || "once";
  if (t === "once") return null;
  const label =
    t === "daily" ? "Daily" :
    t === "interval" ? `Every ${session.repeat_interval_hours || 4}h` :
    "Custom";
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary/40 text-foreground/80 inline-flex items-center gap-1">
      <Repeat size={10} /> {label}
    </span>
  );
};

const NextSlotLine = ({ session }: { session: any }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);
  if (session.session_type === "funnel_video") {
    const live = currentLiveSlot(session);
    if (live) return <>Started {formatDistanceToNow(new Date(live))} ago — currently live</>;
    const nxt = nextSlotFn(session);
    if (nxt) return <>Next: {format(new Date(nxt), "MMM d, h:mm a")} (in {formatDistanceToNow(new Date(nxt))})</>;
    const slots = computeSessionSlots(session);
    if (slots.length) return <>Last played {formatDistanceToNow(new Date(slots[slots.length - 1]))} ago</>;
    return <>No times scheduled</>;
  }
  if (session.scheduled_at) {
    const d = new Date(session.scheduled_at);
    if (d.getTime() > Date.now()) return <>Starts in {formatDistanceToNow(d)}</>;
    return <>{format(d, "MMM d, h:mm a")}</>;
  }
  return <>Not scheduled</>;
};

const LivePage = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"upgrade" | "limit">("upgrade");
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const { isFree, canCreateLive, config, counts, tier } = usePlanLimits() as any;

  const upd = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["live-sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const liveStateRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    for (const s of sessions as any[]) {
      const isLive = currentLiveSlot(s) !== null;
      const wasLive = liveStateRef.current[s.id];
      if (wasLive === undefined) { liveStateRef.current[s.id] = isLive; continue; }
      if (!wasLive && isLive) {
        toast.success(`"${s.title}" is now live`, {
          description: `${s.registration_count || 0} registered viewers can join now`,
          action: { label: "View", onClick: () => navigate(`/live/${s.id}`) },
        });
      } else if (wasLive && !isLive) {
        toast(`"${s.title}" has ended`, {
          description: s.replay_enabled ? "Replay is being prepared" : "Session is closed",
        });
      }
      liveStateRef.current[s.id] = isLive;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const { data: funnels = [] } = useQuery({
    queryKey: ["live-funnel-options", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnels")
        .select("id, title, slug, thumbnail_url, video_asset_id, is_published")
        .eq("owner_id", user!.id)
        .not("video_asset_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && creating,
  });

  useEffect(() => {
    const run = async () => {
      if (!form.funnel_id) return;
      const f = funnels.find((x: any) => x.id === form.funnel_id);
      if (!f) return;
      if (!f.video_asset_id) {
        upd("video_asset_id", null);
        upd("video_duration_seconds", null);
        return;
      }
      const { data: video } = await supabase
        .from("video_assets")
        .select("id, duration_seconds")
        .eq("id", f.video_asset_id)
        .maybeSingle();
      if (video) {
        upd("video_asset_id", video.id);
        upd("video_duration_seconds", video.duration_seconds || null);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.funnel_id]);

  const selectedFunnel = useMemo(
    () => funnels.find((f: any) => f.id === form.funnel_id),
    [funnels, form.funnel_id]
  );

  const editingSession = useMemo(
    () => editingId ? sessions.find((s: any) => s.id === editingId) : null,
    [editingId, sessions]
  );
  const isEditingLive = editingSession && currentLiveSlot(editingSession) !== null;

  const buildPayload = () => {
    const isFunnel = form.session_type === "funnel_video";
    const scheduled_times = form.scheduled_times
      .filter((t) => !!t)
      .map((t) => new Date(t).toISOString());
    const firstSlot = scheduled_times[0] || null;

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      session_type: form.session_type,
      access_type: form.access_type,
      max_attendees: form.max_attendees,
      replay_enabled: form.replay_enabled,
      replay_delay_minutes: form.replay_delay_minutes,
      replay_expires_hours: form.replay_expires_hours,
      replay_per_slot: form.replay_per_slot,
      is_published: form.is_published,
      timezone: form.timezone,
      scheduled_times,
      scheduled_at: firstSlot,
      status: scheduled_times.length ? "scheduled" : "draft",
      show_name: form.show_name, show_phone: form.show_phone,
      show_email: form.show_email, show_city: form.show_city,
      show_viewer_count: form.show_viewer_count,
      repeat_type: form.repeat_type,
      repeat_interval_hours: form.repeat_type === "interval" ? form.repeat_interval_hours : null,
      repeat_window_start: form.repeat_type === "interval" ? form.repeat_window_start + ":00" : null,
      repeat_window_end: form.repeat_type === "interval" ? form.repeat_window_end + ":00" : null,
      repeat_end_date: (form.repeat_type === "daily" || form.repeat_type === "interval") && form.repeat_end_date ? form.repeat_end_date : null,
    };

    if (isFunnel) {
      payload.funnel_id = form.funnel_id;
      payload.video_asset_id = form.video_asset_id;
      payload.video_duration_seconds = form.video_duration_seconds;
      payload.duration_minutes = form.video_duration_seconds
        ? Math.max(1, Math.ceil(form.video_duration_seconds / 60))
        : form.duration_minutes;
    } else {
      payload.platform = form.platform;
      payload.meeting_url = form.meeting_url || null;
      payload.duration_minutes = form.duration_minutes;
    }

    if (form.access_type === "paid") {
      payload.payment_amount = form.payment_amount;
      payload.upi_id = form.upi_id || null;
      payload.payment_instructions = form.payment_instructions || null;
    }

    return payload;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.session_type === "funnel_video") {
        if (!form.funnel_id) throw new Error("Please select a funnel first");
        if (!form.scheduled_times.some(Boolean)) throw new Error("Please add at least one scheduled time");
      } else if (!form.meeting_url) {
        throw new Error("Please add a meeting URL");
      }

      const payload = buildPayload();

      if (editingId) {
        const { error } = await supabase.from("live_sessions").update(payload as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const slug = generateSlug(form.title) + "-" + Math.random().toString(36).slice(2, 7);
        const { error } = await supabase.from("live_sessions").insert({
          ...payload,
          slug,
          owner_id: user!.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Session updated!" : "Session created!");
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      setCreating(false);
      setEditingId(null);
      setStep(1);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save session"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("live_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session deleted");
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["resource-counts"] });
    },
  });

  const startCreate = () => {
    if (isFree) { setModalType("upgrade"); setModalOpen(true); return; }
    if (!canCreateLive) { setModalType("limit"); setModalOpen(true); return; }
    setEditingId(null);
    setForm(emptyForm());
    setStep(1);
    setCreating(true);
  };

  const startEdit = (s: any) => {
    const initial: FormState = {
      ...emptyForm(),
      title: s.title || "",
      description: s.description || "",
      session_type: (s.session_type as SessionType) || "funnel_video",
      funnel_id: s.funnel_id || null,
      video_asset_id: s.video_asset_id || null,
      video_duration_seconds: s.video_duration_seconds || null,
      platform: s.platform || "zoom",
      meeting_url: s.meeting_url || "",
      scheduled_times: Array.isArray(s.scheduled_times) && s.scheduled_times.length
        ? s.scheduled_times.map(isoToDatetimeLocal)
        : [defaultDateTime()],
      timezone: s.timezone || "Asia/Kolkata",
      duration_minutes: s.duration_minutes || 60,
      repeat_type: (s.repeat_type as RepeatType) || "once",
      repeat_interval_hours: s.repeat_interval_hours || 4,
      repeat_window_start: (s.repeat_window_start || "09:00:00").slice(0, 5),
      repeat_window_end: (s.repeat_window_end || "21:00:00").slice(0, 5),
      repeat_end_date: s.repeat_end_date || "",
      replay_enabled: s.replay_enabled !== false,
      replay_delay_minutes: s.replay_delay_minutes ?? s.replay_available_after_minutes ?? 0,
      replay_expires_hours: s.replay_expires_hours ?? null,
      replay_per_slot: s.replay_per_slot !== false,
      is_published: s.is_published !== false,
      max_attendees: s.max_attendees || null,
      access_type: s.access_type || "public",
      show_name: !!s.show_name, show_phone: !!s.show_phone,
      show_email: !!s.show_email, show_city: !!s.show_city,
      show_viewer_count: s.show_viewer_count !== false,
      payment_amount: s.payment_amount || 0,
      upi_id: s.upi_id || "",
      payment_instructions: s.payment_instructions || "",
    };
    setForm(initial);
    setEditingId(s.id);
    setStep(1);
    setCreating(true);
  };

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("live_sessions").update({ is_published: val } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
    },
  });

  const shareUrl = (slug: string) => `${window.location.origin}/s/${slug}`;
  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(shareUrl(slug));
    toast.success("Link copied!");
  };
  const shareWhatsApp = (s: any) => {
    const url = shareUrl(s.slug);
    let when = "";
    if (s.session_type === "funnel_video") {
      const next = nextSlotFn(s);
      if (next) when = ` — starts at ${format(new Date(next), "MMM d, h:mm a")}`;
    } else if (s.scheduled_at) {
      when = ` — starts at ${format(new Date(s.scheduled_at), "MMM d, h:mm a")}`;
    }
    const text = `Join my live session "${s.title}"${when}.\nClick here to join: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const stats = useMemo(() => {
    let live = 0, totalViews = 0, totalRegs = 0;
    for (const s of sessions as any[]) {
      if (currentLiveSlot(s)) live++;
      totalViews += s.total_views || 0;
      totalRegs += s.registration_count || 0;
    }
    return { total: sessions.length, live, totalViews, totalRegs };
  }, [sessions]);

  const totalSteps = 4;
  const canNextFromStep1 = !!form.session_type;
  const canNextFromStep2 =
    form.session_type === "funnel_video"
      ? !!form.title.trim() && !!form.funnel_id
      : !!form.title.trim() && !!form.platform;
  const canNextFromStep3 =
    form.session_type === "funnel_video"
      ? form.scheduled_times.some((t) => !!t)
      : !!form.meeting_url;
  const finalCanSubmit =
    form.session_type === "funnel_video"
      ? !!form.title.trim() && !!form.funnel_id && form.scheduled_times.some(Boolean)
      : !!form.title.trim() && !!form.meeting_url;

  const content = (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-heading font-bold">Live</h1>
              <div className="page-header-accent" />
              <p className="text-sm text-muted-foreground mt-1">
                Schedule a funnel video to play at specific times — or share a meeting link.
              </p>
            </div>
            {!isFree && config?.max_live_sessions !== -1 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${counts?.live_sessions >= config?.max_live_sessions ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                {counts?.live_sessions}/{config?.max_live_sessions}
              </span>
            )}
          </div>
          <Button onClick={startCreate}>
            <Plus size={16} /> New Session
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="glass-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p><p className="text-lg font-bold">{stats.total}</p></div>
            <div className="glass-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live now</p><p className="text-lg font-bold text-red-500">{stats.live}</p></div>
            <div className="glass-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Views</p><p className="text-lg font-bold">{stats.totalViews}</p></div>
            <div className="glass-card p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Registered</p><p className="text-lg font-bold">{stats.totalRegs}</p></div>
          </div>
        )}

        {creating && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto pt-8 pb-8 px-4">
            <div className="glass-card w-full max-w-2xl p-6 space-y-5 relative">
              <button onClick={() => { setCreating(false); setEditingId(null); }} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>

              <div>
                <h2 className="text-lg font-heading font-bold">{editingId ? "Edit Live Session" : "Create Live Session"}</h2>
                {isEditingLive && (
                  <div className="mt-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200">
                    ⚠ This session is currently <strong>live</strong>. Edits will only affect future scheduled slots.
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-3">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">Step {step} of {totalSteps}</p>
              </div>

              {step === 1 && (
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold mb-1">How will this session be delivered?</h3>
                    <p className="text-xs text-muted-foreground">Your funnel video plays automatically at scheduled times.</p>
                  </div>
                  <div className="w-full text-left p-4 rounded-xl border-2 border-primary bg-primary/5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Layers size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Use Existing Funnel</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">SELECTED</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your funnel video plays automatically at scheduled times — viewers see it like a real live stream.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Session Title *</Label>
                    <Input value={form.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. Weekly Training Call" className="mt-1 bg-muted border-border" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <Textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder="What this session is about..." className="mt-1 bg-muted border-border" rows={2} maxLength={300} />
                  </div>

                  {form.session_type === "funnel_video" ? (
                    <div>
                      <Label className="text-sm font-medium">Select Funnel *</Label>
                      <Select value={form.funnel_id ?? "__none__"} onValueChange={(v) => upd("funnel_id", v === "__none__" ? null : v)}>
                        <SelectTrigger className="mt-1 bg-muted border-border"><SelectValue placeholder="Choose a funnel..." /></SelectTrigger>
                        <SelectContent>
                          {funnels.length === 0 && <SelectItem value="__none__" disabled>No funnels with video found</SelectItem>}
                          {funnels.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {selectedFunnel && (
                        <div className="mt-3 flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                          {selectedFunnel.thumbnail_url ? (
                            <img src={selectedFunnel.thumbnail_url} alt="" className="w-16 h-12 rounded object-cover" />
                          ) : (
                            <div className="w-16 h-12 rounded bg-muted flex items-center justify-center"><Video size={16} className="text-muted-foreground" /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{selectedFunnel.title}</p>
                            <p className="text-xs text-muted-foreground">Video duration: {formatDuration(form.video_duration_seconds)}</p>
                          </div>
                        </div>
                      )}
                      {funnels.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          You need a published funnel with a video first.{" "}
                          <button onClick={() => navigate("/funnels")} className="text-primary underline">Create one</button>.
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-border">
                        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setVideoPickerOpen(true)}>
                          <Video size={14} /> Pick from your video library
                        </Button>
                        <p className="text-[11px] text-muted-foreground mt-1.5">We'll auto-select the funnel that uses that video.</p>
                      </div>
                      <VideoPickerModal
                        open={videoPickerOpen}
                        onClose={() => setVideoPickerOpen(false)}
                        onSelect={(videoId, title) => {
                          const match = (funnels as any[]).find((f) => f.video_asset_id === videoId);
                          if (match) {
                            upd("funnel_id", match.id);
                            toast.success(`Selected funnel "${match.title}" containing "${title}"`);
                          } else {
                            toast.error(`No funnel uses "${title}" yet. Create a funnel with this video first.`);
                          }
                          setVideoPickerOpen(false);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Platform</Label>
                        <Select value={form.platform} onValueChange={(v) => upd("platform", v)}>
                          <SelectTrigger className="mt-1 bg-muted border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zoom">Zoom</SelectItem>
                            <SelectItem value="google_meet">Google Meet</SelectItem>
                            <SelectItem value="custom">Custom Link</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Duration (mins)</Label>
                        <NumberInput min={5} max={600} suffix="mins" value={form.duration_minutes} onValueChange={(n) => upd("duration_minutes", typeof n === "number" ? n : 60)} className="mt-1" />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">Access Type</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {[
                        { val: "public", label: "Public", icon: Globe, desc: "Anyone can join" },
                        { val: "lead_gated", label: "Registration", icon: Users, desc: "Collect info first" },
                        { val: "paid", label: "Paid", icon: IndianRupee, desc: "Payment required" },
                      ].map((opt) => (
                        <button key={opt.val} onClick={() => upd("access_type", opt.val)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                            form.access_type === opt.val ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40"
                          }`}>
                          <opt.icon size={18} />
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(form.access_type === "lead_gated" || form.access_type === "paid") && (
                    <div className="space-y-2 p-3 bg-muted/40 rounded-xl">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registration Form</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "show_name", label: "Name" },
                          { key: "show_phone", label: "Phone" },
                          { key: "show_email", label: "Email" },
                          { key: "show_city", label: "City" },
                        ].map((f) => (
                          <div key={f.key} className="flex items-center justify-between">
                            <Label className="text-xs">{f.label}</Label>
                            <Switch checked={(form as any)[f.key]} onCheckedChange={(v) => upd(f.key as any, v as any)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.access_type === "paid" && (
                    <div className="space-y-3 p-3 bg-muted/40 rounded-xl">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Amount (₹)</Label>
                          <NumberInput min={0} prefix="₹" value={form.payment_amount} onValueChange={(n) => upd("payment_amount", typeof n === "number" ? n : 0)} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">UPI ID</Label>
                          <Input value={form.upi_id} onChange={(e) => upd("upi_id", e.target.value)} className="mt-1 bg-muted border-border" placeholder="name@upi" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Payment Instructions</Label>
                        <Textarea value={form.payment_instructions} onChange={(e) => upd("payment_instructions", e.target.value)} className="mt-1 bg-muted border-border" rows={2} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-heading font-semibold">When should this session play?</h2>
                    <p className="text-[12px] text-muted-foreground">All scheduled times use the same public link.</p>
                  </div>

                  {form.session_type === "external_link" && (
                    <div>
                      <Label className="text-sm font-medium">Meeting URL *</Label>
                      <Input value={form.meeting_url} onChange={(e) => upd("meeting_url", e.target.value)} placeholder="https://zoom.us/j/..." className="mt-1 bg-muted border-border" />
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">Base date & time *</Label>
                    <Input type="datetime-local" value={form.scheduled_times[0] || ""}
                      onChange={(e) => {
                        const arr = [...form.scheduled_times];
                        arr[0] = e.target.value;
                        upd("scheduled_times", arr);
                      }}
                      className="bg-muted border-border" />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Timezone</Label>
                    <Select value={form.timezone} onValueChange={(v) => upd("timezone", v)}>
                      <SelectTrigger className="mt-1 bg-muted border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">How often should it play live?</Label>
                    <div className="grid sm:grid-cols-2 gap-2 mt-2">
                      {[
                        { val: "once", label: "Play Once", desc: "Plays one time", icon: Play },
                        { val: "daily", label: "Repeat Daily", desc: "Every day same time", icon: CalendarRange },
                        { val: "interval", label: "Every Few Hours", desc: "Multiple times per day", icon: RotateCcw },
                        { val: "custom", label: "Custom Schedule", desc: "Pick specific times", icon: ListChecks },
                      ].map((opt) => {
                        const active = form.repeat_type === opt.val;
                        return (
                          <button key={opt.val} onClick={() => upd("repeat_type", opt.val as RepeatType)}
                            className={`text-left p-3 rounded-xl border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}>
                            <div className="flex items-start gap-2">
                              <opt.icon size={16} className={active ? "text-primary mt-0.5" : "text-muted-foreground mt-0.5"} />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{opt.label}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(form.repeat_type === "daily" || form.repeat_type === "interval") && (
                    <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
                      {form.repeat_type === "interval" && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Every</Label>
                            <Select value={String(form.repeat_interval_hours)} onValueChange={(v) => upd("repeat_interval_hours", parseInt(v))}>
                              <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[2, 3, 4, 6, 8, 12].map((h) => <SelectItem key={h} value={String(h)}>{h} hours</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">From</Label>
                            <Input type="time" value={form.repeat_window_start} onChange={(e) => upd("repeat_window_start", e.target.value)} className="mt-1 bg-background border-border" />
                          </div>
                          <div>
                            <Label className="text-xs">Until</Label>
                            <Input type="time" value={form.repeat_window_end} onChange={(e) => upd("repeat_window_end", e.target.value)} className="mt-1 bg-background border-border" />
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Stop repeating after (optional)</Label>
                        <Input type="date" value={form.repeat_end_date} onChange={(e) => upd("repeat_end_date", e.target.value)} className="mt-1 bg-background border-border" />
                      </div>
                    </div>
                  )}

                  {form.repeat_type === "custom" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Add up to 20 specific times.</Label>
                      <div className="rounded-lg bg-muted/40 border border-border p-2.5 space-y-1.5">
                        {form.scheduled_times.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-muted-foreground w-[68px] shrink-0">Session {idx + 1}</span>
                            <Input type="datetime-local" value={t} onChange={(e) => {
                              const arr = [...form.scheduled_times];
                              arr[idx] = e.target.value;
                              upd("scheduled_times", arr);
                            }} className="bg-background border-border flex-1 h-8 text-xs" />
                            {idx > 0 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                                onClick={() => upd("scheduled_times", form.scheduled_times.filter((_, i) => i !== idx))}>
                                <Trash size={12} />
                              </Button>
                            )}
                          </div>
                        ))}
                        {form.scheduled_times.length < 20 && (
                          <Button variant="outline" size="sm" type="button" className="mt-1"
                            onClick={() => upd("scheduled_times", [...form.scheduled_times, ""])}>
                            <Plus size={14} /> Add another time
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-heading font-semibold">Can viewers rewatch a recording after it ends?</h2>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <div className="flex-1 pr-3">
                      <Label className="text-sm font-medium">Allow viewers to rewatch this session</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {form.replay_enabled ? "Viewers can watch a recording after each live session ends." : "Viewers must join during the live session."}
                      </p>
                    </div>
                    <Switch checked={form.replay_enabled} onCheckedChange={(v) => upd("replay_enabled", v)} />
                  </div>

                  {form.replay_enabled && form.session_type === "funnel_video" && (
                    <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <div>
                        <Label className="text-xs">When should replay become available?</Label>
                        <Select value={String(form.replay_delay_minutes)} onValueChange={(v) => upd("replay_delay_minutes", parseInt(v))}>
                          <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Immediately when session ends</SelectItem>
                            <SelectItem value="30">After 30 minutes</SelectItem>
                            <SelectItem value="60">After 1 hour</SelectItem>
                            <SelectItem value="1440">After 24 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">How long should replay stay available?</Label>
                        <Select value={form.replay_expires_hours === null ? "forever" : String(form.replay_expires_hours)}
                          onValueChange={(v) => upd("replay_expires_hours", v === "forever" ? null : parseInt(v))}>
                          <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="forever">Forever</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="48">48 hours</SelectItem>
                            <SelectItem value="168">7 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <div>
                      <Label className="text-sm font-medium">Publish this session</Label>
                      <p className="text-[11px] text-muted-foreground">Unpublished sessions show "Not available" to viewers</p>
                    </div>
                    <Switch checked={form.is_published} onCheckedChange={(v) => upd("is_published", v)} />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <div>
                      <Label className="text-sm font-medium">Show live viewer count</Label>
                    </div>
                    <Switch checked={form.show_viewer_count} onCheckedChange={(v) => upd("show_viewer_count", v)} />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Max Attendees (optional)</Label>
                    <NumberInput min={1} max={100000} value={form.max_attendees ?? ""}
                      onValueChange={(n) => upd("max_attendees", n === "" ? null : n)}
                      placeholder="Unlimited" className="mt-1" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" size="sm" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
                  <ChevronLeft size={14} /> Back
                </Button>
                {step < totalSteps ? (
                  <Button size="sm"
                    disabled={(step === 1 && !canNextFromStep1) || (step === 2 && !canNextFromStep2) || (step === 3 && !canNextFromStep3)}
                    onClick={() => setStep((s) => s + 1)}>
                    Next <ChevronRight size={14} />
                  </Button>
                ) : (
                  <Button size="sm" disabled={!finalCanSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                    {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Schedule Session"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="glass-card p-12 text-center"><p className="text-sm text-muted-foreground">Loading sessions...</p></div>
        ) : sessions.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Radio size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading font-semibold mb-2">No live sessions yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Create your first session to start reaching your audience live.
            </p>
            <Button onClick={startCreate}><Plus size={16} /> Create Your First Session</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s: any) => {
              const linkedFunnelTitle = s.session_type === "funnel_video"
                ? funnels.find((f: any) => f.id === s.funnel_id)?.title
                : null;
              return (
                <div key={s.id} className="glass-card p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-heading font-semibold text-sm truncate">{s.title}</h3>
                        <SessionStatusBadge session={s} />
                        <RepeatBadge session={s} />
                        {s.session_type === "funnel_video" ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary inline-flex items-center gap-1">
                            <Layers size={10} /> Funnel video
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                            <ExternalLink size={10} /> External link
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {linkedFunnelTitle && (
                          <span className="flex items-center gap-1 truncate max-w-[200px]"><Layers size={12} /> {linkedFunnelTitle}</span>
                        )}
                        <span className="flex items-center gap-1"><Calendar size={12} /> <NextSlotLine session={s} /></span>
                        <span className="flex items-center gap-1"><Users size={12} /> {s.registration_count || 0} registered</span>
                        <span className="flex items-center gap-1"><Eye size={12} /> {s.total_views || 0} views</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => copyLink(s.slug)}>
                        <Copy size={14} /> Copy Link
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Share on WhatsApp" onClick={() => shareWhatsApp(s)}>
                        <MessageCircle size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => startEdit(s)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => navigate(`/live/${s.id}`)}>
                        <Eye size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={s.is_published === false ? "Publish" : "Unpublish"}
                        onClick={() => togglePublishMutation.mutate({ id: s.id, val: s.is_published === false })}>
                        <Globe size={14} className={s.is_published === false ? "opacity-40" : ""} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={async () => {
                        if (await confirm({ title: "Delete this session?", description: "This action cannot be undone.", confirmLabel: "Delete", destructive: true })) deleteMutation.mutate(s.id);
                      }}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        resource="live sessions"
        currentCount={counts?.live_sessions}
        limit={config?.max_live_sessions}
        tier={tier}
        reason="live"
      />
    </>
  );
  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default LivePage;
