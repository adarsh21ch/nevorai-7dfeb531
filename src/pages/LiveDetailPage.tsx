import { useState, useMemo } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Calendar, Users, Copy,
  ExternalLink, Radio, Eye, Check, X, Pencil,
  Square, Ban, CalendarPlus, MessageCircle, Share2, Repeat, Globe,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  computeSessionSlots, currentLiveSlot, nextSlot as nextSlotFn,
  sessionDurationSec, googleCalendarUrl, buildICS, downloadICS,
} from "@/lib/liveSession";

const LiveDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUrl, setEditingUrl] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");

  const { data: session, isLoading } = useQuery({
    queryKey: ["live-session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      setMeetingUrl((data as any).meeting_url || "");
      return data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["live-registrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_registrations")
        .select("*")
        .eq("session_id", id!)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: analytics = [] } = useQuery({
    queryKey: ["live-analytics", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_session_analytics")
        .select("*")
        .eq("session_id", id!)
        .order("session_slot", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const updateSession = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("live_sessions").update(updates as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-session", id] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e?.message || "Update failed"),
  });

  const updateReg = useMutation({
    mutationFn: async ({ regId, updates }: { regId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("live_registrations").update(updates as any).eq("id", regId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-registrations", id] });
    },
  });

  const upcomingSlots = useMemo(() => {
    if (!session) return [] as number[];
    const now = Date.now();
    return computeSessionSlots(session as any).filter((s) => s > now).slice(0, 8);
  }, [session]);

  const timelineSlots = useMemo(() => {
    if (!session) return [] as number[];
    const all = computeSessionSlots(session as any);
    const now = Date.now();
    const idx = all.findIndex((s) => s > now);
    const start = Math.max(0, (idx === -1 ? all.length : idx) - 3);
    return all.slice(start, start + 12);
  }, [session]);

  const liveNow = useMemo(() => session ? currentLiveSlot(session as any) : null, [session]);
  const nextOne = useMemo(() => session ? nextSlotFn(session as any) : null, [session]);

  if (isLoading || !session) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const s: any = session;
  const isFunnel = s.session_type === "funnel_video";
  const isCancelled = s.status === "cancelled";
  const publicUrl = `${window.location.origin}/s/${s.slug}`;
  const totalWatchMin = analytics.reduce((acc: number, a: any) => acc + Math.floor((a.total_watch_seconds || 0) / 60), 0);
  const totalUnique = analytics.reduce((acc: number, a: any) => acc + (a.unique_viewers || 0), 0);

  const repeatLabel =
    s.repeat_type === "daily" ? "Repeats daily" :
    s.repeat_type === "interval" ? `Every ${s.repeat_interval_hours || 4} hours` :
    s.repeat_type === "custom" ? "Custom schedule" :
    "Plays once";

  const addToCalendar = (kind: "google" | "ics", iso: string) => {
    const start = new Date(iso);
    const end = new Date(start.getTime() + sessionDurationSec(s) * 1000);
    if (kind === "google") {
      window.open(googleCalendarUrl({ title: s.title, description: s.description || "", start, end, url: publicUrl }), "_blank");
    } else {
      const ics = buildICS({ title: s.title, description: s.description || "", start, end, url: publicUrl, uid: `${s.id}-${start.getTime()}` });
      downloadICS(`${s.slug}-${start.getTime()}.ics`, ics);
    }
  };

  const shareWhatsApp = () => {
    const next = nextOne ? ` — starts ${format(new Date(nextOne), "MMM d, h:mm a")}` : "";
    const text = `Join my live session "${s.title}"${next}.\n${publicUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/live")} className="h-8 w-8 shrink-0">
              <ArrowLeft size={16} />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-heading font-bold truncate">{s.title}</h1>
                {liveNow && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-500 inline-flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                    </span>
                    LIVE
                  </span>
                )}
                {isCancelled && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-500">CANCELLED</span>}
                {s.is_published === false && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">UNPUBLISHED</span>}
                {s.repeat_type !== "once" && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary/40 text-foreground/80 inline-flex items-center gap-1">
                    <Repeat size={10} /> {repeatLabel}
                  </span>
                )}
              </div>
              {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
              <Eye size={14} /> View public
            </Button>
            {!isCancelled && liveNow && (
              <Button variant="outline" size="sm"
                onClick={() => { if (confirm("Stop the current live slot now?")) updateSession.mutate({ status: "ended" }); }}>
                <Square size={14} /> Stop now
              </Button>
            )}
            {!isCancelled && (
              <Button variant="outline" size="sm" className="text-destructive"
                onClick={() => { if (confirm("Cancel this entire session?")) updateSession.mutate({ status: "cancelled" }); }}>
                <Ban size={14} /> Cancel
              </Button>
            )}
            {isCancelled && (
              <Button variant="outline" size="sm" onClick={() => updateSession.mutate({ status: "scheduled" })}>
                Reactivate
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Registered</p>
            <p className="text-xl font-bold">{registrations.length}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total viewers</p>
            <p className="text-xl font-bold">{totalUnique}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Watch time</p>
            <p className="text-xl font-bold">{totalWatchMin}m</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Slots</p>
            <p className="text-xl font-bold">{computeSessionSlots(s).length}</p>
          </div>
        </div>

        <div className="glass-card p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Public Session Link</Label>
          <div className="flex items-center gap-2">
            <code className="text-sm text-primary flex-1 truncate">{publicUrl}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied!"); }}>
              <Copy size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink size={14} />
            </Button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={shareWhatsApp} className="text-emerald-500"><MessageCircle size={14} /> WhatsApp</Button>
            {nextOne && (
              <>
                <Button variant="outline" size="sm" onClick={() => addToCalendar("google", new Date(nextOne).toISOString())}><CalendarPlus size={14} /> Google</Button>
                <Button variant="outline" size="sm" onClick={() => addToCalendar("ics", new Date(nextOne).toISOString())}><CalendarPlus size={14} /> .ics</Button>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Published</Label>
              <Switch checked={s.is_published !== false} onCheckedChange={(v) => updateSession.mutate({ is_published: v })} />
            </div>
          </div>
        </div>

        {isFunnel && timelineSlots.length > 0 && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-sm">Sessions timeline</h3>
              <span className="text-[11px] text-muted-foreground">{repeatLabel}</span>
            </div>
            <div className="space-y-1.5">
              {timelineSlots.map((ms, i) => {
                const dur = sessionDurationSec(s) * 1000;
                const now = Date.now();
                const isLive = now >= ms && now <= ms + dur;
                const isPast = ms + dur < now;
                const isFuture = ms > now;
                const replayOn = !!s.replay_enabled;
                const seqNum = i + 1;
                let dot = "⏳", statusText = "", statusCls = "text-muted-foreground";
                if (isLive) { dot = "🟢"; statusText = "● Live now"; statusCls = "text-red-500 font-semibold"; }
                else if (isPast) { dot = "🔴"; statusText = replayOn ? "Ended • Replay available" : "Ended"; }
                else if (isFuture) { dot = "⏳"; statusText = `Starts in ${formatDistanceToNow(new Date(ms))}`; }
                return (
                  <div key={ms} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-xs ${isLive ? "bg-red-500/10 border border-red-500/30" : "bg-muted/50"}`}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base leading-none">{dot}</span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">Session {seqNum} — {format(new Date(ms), "EEE, MMM d 'at' h:mm a")}</p>
                        <p className={`text-[11px] ${statusCls}`}>{statusText}</p>
                      </div>
                    </div>
                    {!isPast && (
                      <button onClick={() => addToCalendar("google", new Date(ms).toISOString())} className="text-muted-foreground hover:text-foreground p-1 shrink-0" title="Add to Google Calendar">
                        <CalendarPlus size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isFunnel && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Meeting URL</Label>
              {!editingUrl ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingUrl(true)}><Pencil size={12} className="mr-1" /> Edit</Button>
              ) : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { updateSession.mutate({ meeting_url: meetingUrl }); setEditingUrl(false); }}><Check size={12} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingUrl(false)}><X size={12} /></Button>
                </div>
              )}
            </div>
            {editingUrl ? (
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} className="bg-muted border-border" />
            ) : (
              <p className="text-sm text-muted-foreground">{s.meeting_url || "No URL added yet"}</p>
            )}
          </div>
        )}

        {isFunnel && (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm">Replay settings</h3>
              <Switch checked={s.replay_enabled !== false} onCheckedChange={(v) => updateSession.mutate({ replay_enabled: v })} />
            </div>
            {s.replay_enabled !== false && (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Available after</Label>
                  <Select value={String(s.replay_delay_minutes ?? 0)} onValueChange={(v) => updateSession.mutate({ replay_delay_minutes: parseInt(v) })}>
                    <SelectTrigger className="mt-1 bg-muted border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Immediately</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="1440">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Stays available</Label>
                  <Select value={s.replay_expires_hours == null ? "forever" : String(s.replay_expires_hours)}
                    onValueChange={(v) => updateSession.mutate({ replay_expires_hours: v === "forever" ? null : parseInt(v) })}>
                    <SelectTrigger className="mt-1 bg-muted border-border"><SelectValue /></SelectTrigger>
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
          </div>
        )}

        {analytics.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="font-heading font-semibold text-sm mb-3">Per-slot analytics</h3>
            <div className="space-y-2">
              {analytics.map((a: any) => {
                const mins = Math.floor((a.total_watch_seconds || 0) / 60);
                return (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl text-xs">
                    <div className="font-medium text-foreground">{format(new Date(a.session_slot), "MMM d, h:mm a")}</div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span><span className="text-foreground font-semibold">{a.unique_viewers}</span> viewers</span>
                      <span><span className="text-foreground font-semibold">{a.peak_concurrent}</span> peak</span>
                      <span><span className="text-foreground font-semibold">{mins}m</span> watched</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass-card p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">Registrations ({registrations.length})</h3>
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No registrations yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {registrations.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.name || "Anonymous"}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {r.phone && <span>{r.phone}</span>}
                      {r.email && <span>{r.email}</span>}
                      {r.city && <span>{r.city}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.access_type === "paid" && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.payment_status === "verified" ? "bg-emerald-500/10 text-emerald-500" :
                        r.payment_status === "pending" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-muted text-muted-foreground"
                      }`}>{r.payment_status || "none"}</span>
                    )}
                    {r.attended ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Attended</span>
                    ) : liveNow ? (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => updateReg.mutate({ regId: r.id, updates: { attended: true, attended_at: new Date().toISOString() } })}>
                        Mark Attended
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LiveDetailPage;
