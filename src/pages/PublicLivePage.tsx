import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/landing/Logo";
import {
  Calendar, Clock, Users, ExternalLink, IndianRupee, Play, Pause, Volume2, VolumeX,
  CalendarPlus, Share2, MessageCircle, Copy, Maximize2, Minimize2, Loader2, Radio,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { googleCalendarUrl, buildICS, downloadICS } from "@/lib/liveSession";

type ViewerState = "waiting" | "live" | "ended" | "replay";

interface StateResponse {
  state: ViewerState;
  seek_seconds: number;
  next_slot: string | null;
  current_slot_start: string | null;
  current_slot_end: string | null;
  seconds_until_next: number;
  replay_available: boolean;
  last_ended_slot?: string | null;
  video_url: string | null;
  video_duration_seconds?: number;
  funnel_data: any;
  session_type: "funnel_video" | "external_link";
  meeting_url?: string | null;
  all_slots: string[];
  concurrent_viewers?: number;
  video_allow_seek?: boolean;
  video_allow_playback_speed?: boolean;
  session: {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    access_type: string;
    replay_enabled: boolean;
    registration_count: number;
    timezone: string;
    show_name?: boolean;
    show_phone?: boolean;
    show_email?: boolean;
    show_city?: boolean;
    show_viewer_count?: boolean;
    duration_minutes?: number;
  };
}

const formatCountdown = (sec: number) => {
  if (sec <= 0) return "Starting now!";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

const PublicLivePage = () => {
  const { slug } = useParams();
  const [stateData, setStateData] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "" });
  const [countdown, setCountdown] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progressNow, setProgressNow] = useState(0);
  const [livePosition, setLivePosition] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [joined, setJoined] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [showAudioBanner, setShowAudioBanner] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const liveSeekDraggingRef = useRef(false);
  const liveSlotAppliedRef = useRef<string | null>(null);
  const viewerTokenRef = useRef<string>("");

  const syncVideoProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.currentTime)) setProgressNow(v.currentTime);
  }, []);

  // Stable opaque viewer token
  useEffect(() => {
    if (!slug) return;
    const key = `nflow_viewer_${slug}`;
    let t = localStorage.getItem(key);
    if (!t) {
      t = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`) + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(key, t);
    }
    viewerTokenRef.current = t;
  }, [slug]);

  // Heartbeat every 15s
  useEffect(() => {
    if (!stateData) return;
    const slot = stateData.current_slot_start || (stateData.all_slots?.length ? stateData.all_slots[stateData.all_slots.length - 1] : null);
    if (!slot || !stateData.session?.id) return;
    if (stateData.state !== "live" && stateData.state !== "replay") return;

    const send = async () => {
      const v = videoRef.current;
      if (v && v.paused) return;
      try {
        await supabase.rpc("record_live_heartbeat" as any, {
          _session_id: stateData.session.id,
          _session_slot: slot,
          _viewer_token: viewerTokenRef.current,
          _delta_seconds: 15,
        });
      } catch (e) { /* ignore */ }
    };
    send();
    const i = setInterval(send, 15_000);
    return () => clearInterval(i);
  }, [stateData?.state, stateData?.session?.id, stateData?.current_slot_start]);

  const fetchState = useCallback(async () => {
    if (!slug) return;
    try {
      const { data, error } = await supabase.functions.invoke("get-live-session-state", { body: { slug } });
      if (error) throw error;
      setStateData(data as StateResponse);
      setCountdown(data?.seconds_until_next || 0);
    } catch (e) {
      console.error("fetchState failed", e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchState(); }, [fetchState]);

  useEffect(() => {
    const i = setInterval(fetchState, 30_000);
    return () => clearInterval(i);
  }, [fetchState]);

  useEffect(() => {
    if (!stateData || stateData.state !== "waiting") return;
    const i = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, [stateData]);

  // Tick current playhead during LIVE for the progress bar
  useEffect(() => {
    if (!stateData || stateData.state !== "live") return;
    syncVideoProgress();
    const i = setInterval(syncVideoProgress, 250);
    return () => clearInterval(i);
  }, [stateData?.state, stateData?.video_url, syncVideoProgress]);

  // LIVE timeline: the right edge is "now", measured from the slot start.
  useEffect(() => {
    if (!stateData || stateData.state !== "live" || !stateData.current_slot_start) {
      setLivePosition(0);
      return;
    }
    const sessionStartTimestamp = new Date(stateData.current_slot_start).getTime() / 1000;
    const tick = () => setLivePosition(Math.max(0, Date.now() / 1000 - sessionStartTimestamp));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [stateData?.state, stateData?.current_slot_start]);

  // Auto-hide controls after inactivity
  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  // Set position when entering LIVE
  useEffect(() => {
    if (!stateData || stateData.state !== "live" || !videoRef.current || !stateData.video_url) return;
    const slotKey = stateData.current_slot_start || stateData.video_url;
    if (liveSlotAppliedRef.current === slotKey) return;
    liveSlotAppliedRef.current = slotKey;
    const v = videoRef.current;
    const targetSeek = stateData.seek_seconds;
    const apply = () => {
      try {
        if (Math.abs(v.currentTime - targetSeek) > 2) v.currentTime = targetSeek;
        setProgressNow(targetSeek);
        v.play().catch(() => {});
      } catch (_) {}
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });
  }, [stateData?.state, stateData?.video_url, stateData?.seek_seconds]);

  // Lock seeking forward + force re-sync (live state only)
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stateData || stateData.state !== "live") return;
    const onSeeking = () => {
      if (!stateData.current_slot_start) return;
      const livePos = Math.max(0, Math.floor((Date.now() - new Date(stateData.current_slot_start).getTime()) / 1000));
      if (v.currentTime > livePos + 1) v.currentTime = Math.max(0, livePos);
    };
    const onPlay = () => {
      setPaused(false);
      if (!stateData.current_slot_start) return;
      const livePos = Math.max(0, Math.floor((Date.now() - new Date(stateData.current_slot_start).getTime()) / 1000));
      if (v.currentTime > livePos + 1) v.currentTime = livePos;
    };
    const onPause = () => setPaused(true);
    const onRate = () => { if (v.playbackRate !== 1) v.playbackRate = 1; };
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ratechange", onRate);
    return () => {
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ratechange", onRate);
    };
  }, [stateData]);

  const handleRegister = async () => {
    if (!stateData) return;
    setSubmitting(true);
    const { error } = await supabase.from("live_registrations").insert({
      session_id: stateData.session.id,
      name: form.name || null,
      phone: form.phone || null,
      email: form.email || null,
      city: form.city || null,
      status: "registered",
      payment_status: stateData.session.access_type === "paid" ? "pending" : "none",
    });
    setSubmitting(false);
    if (error) { toast.error("Registration failed"); return; }
    setRegistered(true);
    toast.success("You're registered! We'll see you live.");
    fetchState();
  };

  const shareUrl = useMemo(() => `${window.location.origin}/s/${slug}`, [slug]);
  const shareTitle = stateData?.session?.title || "Live session";

  const handleShareNative = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: shareTitle, url: shareUrl }); } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    }
  };
  const handleShareWhatsApp = () => {
    const text = `Join me at "${shareTitle}" — ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  const handleCopy = () => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); };

  const addToCalendar = (kind: "google" | "ics") => {
    if (!stateData) return;
    const startIso = stateData.next_slot || stateData.current_slot_start || stateData.all_slots?.[0];
    if (!startIso) { toast.error("No upcoming time"); return; }
    const start = new Date(startIso);
    const durSec = stateData.video_duration_seconds || (stateData.session?.duration_minutes ?? 60) * 60;
    const end = new Date(start.getTime() + durSec * 1000);
    if (kind === "google") {
      window.open(googleCalendarUrl({ title: shareTitle, description: stateData.session.description || "", start, end, url: shareUrl }), "_blank");
    } else {
      const ics = buildICS({ title: shareTitle, description: stateData.session.description || "", start, end, url: shareUrl, uid: stateData.session.id });
      downloadICS(`${slug}.ics`, ics);
    }
  };

  const handleFullscreen = useCallback(() => {
    const videoEl = videoRef.current;
    const container = containerRef.current;
    if (!videoEl) return;
    const d: any = document;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement;
    if (!isFs) {
      const c: any = container || videoEl;
      const v: any = videoEl;
      try {
        if (c.requestFullscreen) c.requestFullscreen();
        else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
        else if (c.mozRequestFullScreen) c.mozRequestFullScreen();
        else if (c.msRequestFullscreen) c.msRequestFullscreen();
        else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      } catch {}
      try {
        const so: any = (screen as any).orientation;
        so?.lock?.("landscape").catch(() => {});
      } catch {}
    } else {
      try {
        if (d.exitFullscreen) d.exitFullscreen();
        else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
        else if (d.mozCancelFullScreen) d.mozCancelFullScreen();
        else if (d.msExitFullscreen) d.msExitFullscreen();
      } catch {}
      try {
        const so: any = (screen as any).orientation;
        so?.unlock?.();
      } catch {}
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      const d: any = document;
      setIsFullscreen(!!(d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("mozfullscreenchange", onChange);
    document.addEventListener("MSFullscreenChange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("mozfullscreenchange", onChange);
      document.removeEventListener("MSFullscreenChange", onChange);
    };
  }, []);

  // Handle "Join Live" — requires user gesture so audio can play
  const handleJoinLive = useCallback(async () => {
    setJoined(true);
    setVideoLoading(true);
    // Allow video element to mount
    await new Promise((r) => setTimeout(r, 50));
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    try {
      await v.play();
      setShowAudioBanner(false);
    } catch {
      // Autoplay with audio blocked — fallback to muted
      try {
        v.muted = true;
        setMuted(true);
        await v.play();
        setShowAudioBanner(true);
      } catch {}
    }
  }, []);

  // Tap-anywhere unmute fallback
  useEffect(() => {
    if (!showAudioBanner) return;
    const enable = () => {
      const v = videoRef.current;
      if (v) {
        v.muted = false;
        setMuted(false);
        v.play().catch(() => {});
      }
      setShowAudioBanner(false);
    };
    document.addEventListener("click", enable, { once: true });
    document.addEventListener("touchstart", enable, { once: true });
    return () => {
      document.removeEventListener("click", enable);
      document.removeEventListener("touchstart", enable);
    };
  }, [showAudioBanner]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }
  if (!stateData) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo size="lg" />
        <h1 className="text-xl font-heading font-bold">Session Not Available</h1>
        <p className="text-sm text-muted-foreground max-w-sm">This session may have been removed, hasn't been published yet, or the link is incorrect.</p>
      </div>
    );
  }

  const session = stateData.session;
  const funnel = stateData.funnel_data;
  const needsRegistration = session.access_type === "lead_gated" || session.access_type === "paid";
  const isFunnelVideo = stateData.session_type === "funnel_video";
  const speakerName = funnel?.speaker_name;
  const speakerPhoto = funnel?.speaker_photo_url;
  const allSlots = stateData.all_slots || [];

  // ============ EXTERNAL LINK (legacy) ============
  if (!isFunnelVideo) {
    const isLive = stateData.state === "live";
    const isEnded = stateData.state === "ended";
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="border-b border-border px-4 py-3"><Logo size="sm" /></div>
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-3">
            {isLive && <LiveDot />}
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">{session.title}</h1>
            {session.description && <p className="text-sm text-muted-foreground">{session.description}</p>}
          </div>
          {!isEnded && countdown > 0 && (
            <div className="glass-card p-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Starts in</p>
              <p className="text-3xl sm:text-4xl font-heading font-bold text-primary tabular-nums">{formatCountdown(countdown)}</p>
            </div>
          )}
          {!isEnded && needsRegistration && !registered && (
            <RegistrationForm session={session} form={form} setForm={setForm} onSubmit={handleRegister} submitting={submitting} />
          )}
          {(isLive || (registered && !isEnded)) && stateData.meeting_url && (
            <Button variant="hero" size="lg" className="w-full" onClick={() => window.open(stateData.meeting_url!, "_blank")}>
              <ExternalLink size={16} /> {isLive ? "Join Live Session" : "Open Meeting Link"}
            </Button>
          )}
          {isEnded && <p className="text-center text-sm text-muted-foreground">This session has ended.</p>}
        </div>
      </div>
    );
  }

  // ============ FUNNEL VIDEO (simulated live) ============

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <Logo size="sm" />
        {(stateData.state === "live" || stateData.state === "replay") && (
          <button onClick={handleShareNative} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <Share2 size={14} /> Share
          </button>
        )}
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Title & host */}
        <div className="text-center space-y-2">
          {stateData.state === "live" && <LiveDot label="LIVE NOW" />}
          {stateData.state === "replay" && (
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500">REPLAY</span>
          )}
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">{session.title}</h1>
          {session.description && <p className="text-sm text-muted-foreground max-w-xl mx-auto">{session.description}</p>}
          {speakerName && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {speakerPhoto && <img src={speakerPhoto} alt={speakerName} className="w-7 h-7 rounded-full object-cover" />}
              <span className="text-xs text-muted-foreground">Hosted by <span className="text-foreground font-medium">{speakerName}</span></span>
            </div>
          )}
        </div>

        {/* ===== STATE 1 — WAITING (Premium room) ===== */}
        {stateData.state === "waiting" && (
          <>
            {needsRegistration && !registered ? (
              <RegistrationForm session={session} form={form} setForm={setForm} onSubmit={handleRegister} submitting={submitting} />
            ) : (
              <div className="glass-card p-6 sm:p-8 text-center space-y-5">
                {/* "Just ended" banner — shown only when a previous slot ended recently and there's a next one */}
                {stateData.last_ended_slot && stateData.next_slot && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">✅ Session just ended</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {session.replay_enabled
                        ? "Watch the replay below or wait for the next live session."
                        : "The live session you missed has ended. The next one starts soon."}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    {stateData.last_ended_slot ? "Next live session starts in" : "Session begins in"}
                  </p>
                  <p className="text-4xl sm:text-6xl font-heading font-bold text-primary tabular-nums leading-none">
                    {formatCountdown(countdown)}
                  </p>
                  {stateData.next_slot && (
                    <p className="text-xs text-muted-foreground mt-3">
                      <Calendar size={11} className="inline mr-1" />
                      {format(new Date(stateData.next_slot), "EEEE, MMM d 'at' h:mm a")}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                  <Button variant="outline" size="sm" onClick={() => addToCalendar("google")}>
                    <CalendarPlus size={14} /> Google
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addToCalendar("ics")}>
                    <CalendarPlus size={14} /> Apple/Outlook
                  </Button>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider">Invite a friend</p>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="text-emerald-500"><MessageCircle size={14} /> WhatsApp</Button>
                    <Button variant="outline" size="sm" onClick={handleCopy}><Copy size={14} /> Copy</Button>
                    {typeof navigator !== "undefined" && (navigator as any).share && (
                      <Button variant="outline" size="sm" onClick={handleShareNative}><Share2 size={14} /> Share</Button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Keep this page open — it will automatically switch to the live player when the session begins.
                </p>
              </div>
            )}

            {allSlots.length > 1 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">All sessions with this link</p>
                <div className="flex flex-wrap gap-2">
                  {allSlots.slice(0, 12).map((iso) => {
                    const ts = new Date(iso).getTime();
                    const isNext = iso === stateData.next_slot;
                    const isPast = ts + (stateData.video_duration_seconds || (session.duration_minutes ? session.duration_minutes * 60 : 3600)) * 1000 < Date.now();
                    let cls = "bg-muted text-muted-foreground"; // future
                    let prefix = "";
                    if (isNext) { cls = "bg-primary/15 text-primary font-semibold ring-1 ring-primary/40"; prefix = "→ NEXT  "; }
                    else if (isPast) { cls = "bg-muted/40 text-muted-foreground/60 line-through"; prefix = "✓ "; }
                    return (
                      <span key={iso} className={`text-xs px-2 py-1 rounded-lg ${cls}`}>
                        {prefix}{format(new Date(iso), "MMM d, h:mm a")}
                      </span>
                    );
                  })}
                  {allSlots.length > 12 && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">+{allSlots.length - 12} more</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== STATE 2 — LIVE ===== */}
        {stateData.state === "live" && stateData.video_url && !joined && (() => {
          const startedMin = stateData.current_slot_start
            ? Math.max(0, Math.floor((Date.now() - new Date(stateData.current_slot_start).getTime()) / 60000))
            : 0;
          return (
            <div className="glass-card p-6 sm:p-10 text-center space-y-6">
              <LiveDot label="LIVE NOW" />
              <div>
                <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-2">{session.title}</h2>
                <p className="text-sm text-muted-foreground">
                  Session started {startedMin === 0 ? "just now" : `${startedMin} minute${startedMin === 1 ? "" : "s"} ago`}
                </p>
              </div>
              <Button
                onClick={handleJoinLive}
                className="w-full sm:w-auto sm:px-10 h-14 text-base font-bold rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
              >
                <Radio size={18} className="mr-1" /> Join Live Session
              </Button>
              <p className="text-[11px] text-muted-foreground">Audio will be enabled automatically</p>
              <p className="text-[10px] text-muted-foreground pt-2">
                Powered by <span className="text-primary font-semibold">nFlow</span> by Nevorai
              </p>
            </div>
          );
        })()}

        {stateData.state === "live" && stateData.video_url && joined && (() => {
          const liveEdge = Math.max(livePosition, progressNow, 1);
          const played = Math.max(0, Math.min(progressNow, liveEdge));
          const playedPct = Math.min(100, (played / liveEdge) * 100);
          const isBehindLive = played < liveEdge - 5;
          const startedMin = stateData.current_slot_start
            ? Math.max(0, Math.floor((Date.now() - new Date(stateData.current_slot_start).getTime()) / 60000))
            : 0;
          const fmtT = (s: number) => {
            s = Math.max(0, Math.floor(s));
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const r = s % 60;
            if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
            return `${m}:${String(r).padStart(2, "0")}`;
          };
          const seekToLiveEdge = () => {
            const v = videoRef.current; if (!v) return;
            const target = Math.max(0, livePosition);
            v.currentTime = target;
            setProgressNow(target);
            bumpControls();
          };
          const seekToPointer = (clientX: number, track: HTMLDivElement) => {
            const v = videoRef.current; if (!v) return;
            const rect = track.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const target = pct * liveEdge;
            if (target > played + 0.5) return;
            v.currentTime = target;
            setProgressNow(target);
            bumpControls();
          };
          const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
            e.stopPropagation();
            liveSeekDraggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekToPointer(e.clientX, e.currentTarget);
          };
          const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
            if (!liveSeekDraggingRef.current) return;
            e.stopPropagation();
            seekToPointer(e.clientX, e.currentTarget);
          };
          const onBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
            liveSeekDraggingRef.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          };
          return (
          <div className="space-y-2">
            <div
              ref={containerRef}
              className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl group"
              onPointerMove={bumpControls}
              onPointerDown={bumpControls}
            >
              <video
                ref={videoRef}
                src={stateData.video_url}
                className="w-full h-full"
                autoPlay
                playsInline
                // @ts-ignore - webkit attribute
                webkit-playsinline="true"
                preload="auto"
                crossOrigin="anonymous"
                controls={false}
                onLoadedMetadata={syncVideoProgress}
                onLoadedData={() => { syncVideoProgress(); setVideoLoading(false); }}
                onCanPlay={() => { syncVideoProgress(); setVideoLoading(false); }}
                onWaiting={() => setVideoLoading(true)}
                onPlaying={() => setVideoLoading(false)}
                onDurationChange={syncVideoProgress}
                onTimeUpdate={syncVideoProgress}
                onEnded={fetchState}
                onClick={() => {
                  const v = videoRef.current; if (!v) return;
                  if (v.paused) v.play().catch(() => {}); else v.pause();
                  bumpControls();
                }}
              />

              {/* Audio fallback banner */}
              {showAudioBanner && (
                <div className="absolute top-0 left-0 right-0 bg-black/80 text-white text-xs sm:text-sm font-medium px-4 py-2.5 flex items-center justify-center gap-2 z-20">
                  <Volume2 size={16} /> Tap anywhere to enable audio
                </div>
              )}

              {/* Loading spinner */}
              {videoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 pointer-events-none">
                  <Loader2 size={32} className="animate-spin text-white" />
                  <p className="text-white text-xs mt-2">Loading live session...</p>
                </div>
              )}

              {/* LIVE badge — top-left, always visible */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-bold shadow-lg pointer-events-none z-10 animate-pulse">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                LIVE
              </div>

              {/* Controls overlay with progress bar */}
              <div
                className={`absolute bottom-0 left-0 right-0 px-3 pt-10 pb-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent select-none transition-opacity duration-300 ${showControls || paused ? "opacity-100" : "opacity-0 md:opacity-0"} max-md:opacity-100`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Red live progress bar */}
                <div
                  className="relative h-1 hover:h-1.5 transition-all w-full bg-white/25 rounded-full cursor-pointer mb-2 touch-none"
                  onPointerDown={onBarPointerDown}
                  onPointerMove={onBarPointerMove}
                  onPointerUp={onBarPointerUp}
                  onPointerCancel={onBarPointerUp}
                  role="slider"
                  aria-label="Live progress"
                  aria-valuemin={0}
                  aria-valuemax={Math.floor(liveEdge)}
                  aria-valuenow={Math.floor(played)}
                >
                  <div className="absolute inset-y-0 left-0 bg-red-500 rounded-full" style={{ width: `${playedPct}%` }} />
                  <div
                    className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white shadow"
                    style={{ left: `${playedPct}%` }}
                  />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white/80 shadow">
                    <span className="absolute inset-0 rounded-full bg-red-500 animate-ping" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-white">
                  <button
                    className="p-2 hover:scale-110 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                    onClick={() => {
                      const v = videoRef.current; if (!v) return;
                      if (v.paused) v.play().catch(() => {}); else v.pause();
                      bumpControls();
                    }}
                    aria-label={paused ? "Play" : "Pause"}
                  >
                    {paused ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}
                  </button>
                  <button
                    className="p-2 hover:scale-110 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                    onClick={() => {
                      const v = videoRef.current; if (!v) return;
                      const next = !muted;
                      v.muted = next;
                      setMuted(next);
                      bumpControls();
                    }}
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <span className="tabular-nums text-[11px] font-medium text-white/85 ml-1">{fmtT(played)}</span>

                  <div className="ml-auto flex items-center gap-2 text-[11px] font-bold">
                    {isBehindLive && (
                      <button
                        onClick={seekToLiveEdge}
                        className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white inline-flex items-center gap-1"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> BACK TO LIVE
                      </button>
                    )}
                    <span className="inline-flex items-center gap-1.5 tracking-wide">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      LIVE
                    </span>
                    <button
                      className="p-2 hover:scale-110 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
                      onClick={() => { handleFullscreen(); bumpControls(); }}
                      aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Below-player meta */}
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground px-1">
              <div className="flex items-center gap-3 min-w-0">
                {session.show_viewer_count !== false && (stateData.concurrent_viewers ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-foreground font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    {stateData.concurrent_viewers!.toLocaleString()} watching
                  </span>
                )}
                <span className="truncate opacity-70">Live • forward seek &amp; speed disabled</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="opacity-70">Started {startedMin === 0 ? "just now" : `${startedMin}m ago`}</span>
                <button onClick={handleShareNative} className="inline-flex items-center gap-1 hover:text-foreground"><Share2 size={12} /> Share</button>
              </div>
            </div>
          </div>
          );
        })()}


        {/* ===== STATE 3 — ENDED (no future slots) ===== */}
        {stateData.state === "ended" && (
          <div className="glass-card p-8 text-center space-y-5">
            <div>
              <h3 className="text-xl font-heading font-bold mb-1">
                {session.replay_enabled ? "Thanks for watching!" : "All sessions for this series have ended."}
              </h3>
              <p className="text-sm text-muted-foreground">
                {session.replay_enabled ? "This session has ended." : "Thank you for watching."}
              </p>
            </div>

            {session.replay_enabled && countdown > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Replay available in</p>
                <p className="text-3xl font-heading font-bold text-primary tabular-nums">{formatCountdown(countdown)}</p>
              </div>
            )}

            {stateData.next_slot && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Next session</p>
                <p className="text-sm font-semibold">{format(new Date(stateData.next_slot), "EEE, MMM d 'at' h:mm a")}</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => addToCalendar("google")}><CalendarPlus size={14} /> Add to calendar</Button>
                  <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="text-emerald-500"><MessageCircle size={14} /> Invite</Button>
                </div>
              </div>
            )}

            {!session.replay_enabled && !stateData.next_slot && (
              <p className="text-xs text-muted-foreground">No replay or further sessions are scheduled.</p>
            )}
          </div>
        )}

        {/* ===== STATE 4 — REPLAY ===== */}
        {stateData.state === "replay" && stateData.video_url && (() => {
          const replayAllowSeek = stateData.video_allow_seek !== false;
          const replayAllowSpeed = stateData.video_allow_playback_speed !== false;
          return (
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden bg-black aspect-video shadow-2xl relative">
              <video
                ref={videoRef}
                src={stateData.video_url}
                className="w-full h-full"
                controls
                controlsList={`${!replayAllowSeek ? "noplaybackrate " : ""}${!replayAllowSpeed ? "noplaybackrate" : ""}`.trim() || undefined}
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  const maxRef = { v: 0 };
                  v.ontimeupdate = () => { if (v.currentTime > maxRef.v) maxRef.v = v.currentTime; };
                  v.onseeking = () => {
                    if (!replayAllowSeek && v.currentTime > maxRef.v + 0.5) v.currentTime = maxRef.v;
                  };
                  v.onratechange = () => { if (!replayAllowSpeed && v.playbackRate !== 1) v.playbackRate = 1; };
                }}
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-emerald-500/90 text-white text-[11px] font-bold shadow">
                REPLAY
              </div>
            </div>
            {allSlots.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Originally aired: {format(new Date(allSlots[allSlots.length - 1]), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}

            {/* Dual option: when a next live slot exists, surface it clearly */}
            {stateData.next_slot && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
                <div className="text-left min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Or wait for next live session</p>
                  <p className="text-sm font-semibold truncate">
                    Starts in {formatCountdown(countdown)} · {format(new Date(stateData.next_slot), "MMM d, h:mm a")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => addToCalendar("google")} className="shrink-0">
                  <CalendarPlus size={14} /> Calendar
                </Button>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="text-emerald-500"><MessageCircle size={14} /> Share replay</Button>
              <Button variant="outline" size="sm" onClick={handleCopy}><Copy size={14} /> Copy link</Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-muted-foreground"><span className="text-primary font-semibold">nFlow</span> by Nevorai</p>
        </div>
      </div>
    </div>
  );
};

const LiveDot = ({ label = "Live Now" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
    </span>
    <span className="text-sm font-bold text-red-500 uppercase tracking-wider">{label}</span>
  </div>
);

const RegistrationForm = ({
  session, form, setForm, onSubmit, submitting,
}: {
  session: any;
  form: { name: string; phone: string; email: string; city: string };
  setForm: (f: any) => void;
  onSubmit: () => void;
  submitting: boolean;
}) => (
  <div className="glass-card p-6 space-y-4">
    <div className="text-center">
      <h3 className="font-heading font-semibold text-lg">Register to Join</h3>
      <p className="text-xs text-muted-foreground mt-1">Save your spot — we'll let you in when it starts.</p>
    </div>
    <div className="space-y-3">
      {session.show_name !== false && (
        <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-muted border-border" /></div>
      )}
      {session.show_phone !== false && (
        <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 bg-muted border-border" placeholder="+91" /></div>
      )}
      {session.show_email !== false && (
        <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-muted border-border" /></div>
      )}
      {session.show_city && (
        <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1 bg-muted border-border" /></div>
      )}
    </div>
    <Button variant="hero" className="w-full" onClick={onSubmit} disabled={submitting}>
      {submitting ? "Registering..." : "Register & Continue"}
    </Button>
  </div>
);

export default PublicLivePage;
