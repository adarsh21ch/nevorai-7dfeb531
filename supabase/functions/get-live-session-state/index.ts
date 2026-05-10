import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type State = "waiting" | "live" | "ended" | "replay" | "cancelled" | "unpublished";

// Compute slot timestamps (ms) for a session for a window around `now`.
// Looks back 2 days, forward 60 days (capped) for daily/interval.
function computeSlots(session: any, durationSec: number): number[] {
  const repeat = session.repeat_type || "once";
  const baseTimes: number[] = (Array.isArray(session.scheduled_times) ? session.scheduled_times : [])
    .map((t: string) => new Date(t).getTime())
    .filter((t: number) => !isNaN(t));

  if (repeat === "once" || repeat === "custom") {
    return baseTimes.sort((a, b) => a - b);
  }

  if (baseTimes.length === 0) return [];
  const base = baseTimes[0];
  const baseDate = new Date(base);
  const endDate = session.repeat_end_date ? new Date(session.repeat_end_date + "T23:59:59Z").getTime() : null;

  const now = Date.now();
  const windowStart = now - 2 * 86400_000;
  const windowEnd = Math.min(now + 60 * 86400_000, endDate ?? Number.POSITIVE_INFINITY);

  const out: number[] = [];

  if (repeat === "daily") {
    // Add same time every day from base to windowEnd
    let t = base;
    while (t < windowStart) t += 86400_000;
    while (t <= windowEnd) {
      out.push(t);
      t += 86400_000;
    }
    return out.sort((a, b) => a - b);
  }

  if (repeat === "interval") {
    const intervalH = Math.max(1, Math.min(24, session.repeat_interval_hours || 4));
    const intervalMs = intervalH * 3600_000;
    // Window inside each day [windowStartTime, windowEndTime]; default: full day
    const winStart = session.repeat_window_start as string | null; // "HH:MM:SS"
    const winEnd = session.repeat_window_end as string | null;
    const parseHM = (s: string | null) => {
      if (!s) return null;
      const [h, m] = s.split(":").map((x) => parseInt(x, 10));
      return { h: h || 0, m: m || 0 };
    };
    const wStart = parseHM(winStart);
    const wEnd = parseHM(winEnd);

    // Iterate day by day
    const startDay = new Date(windowStart);
    startDay.setHours(0, 0, 0, 0);
    for (let d = startDay.getTime(); d <= windowEnd; d += 86400_000) {
      // First slot of the day
      const day = new Date(d);
      let firstSlot: Date;
      if (wStart) {
        firstSlot = new Date(day);
        firstSlot.setHours(wStart.h, wStart.m, 0, 0);
      } else {
        // Use base time-of-day
        firstSlot = new Date(day);
        firstSlot.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
      }
      let lastSlotMs = endDate ? Math.min(windowEnd, endDate) : windowEnd;
      if (wEnd) {
        const e = new Date(day);
        e.setHours(wEnd.h, wEnd.m, 0, 0);
        lastSlotMs = Math.min(lastSlotMs, e.getTime());
      }
      let t = firstSlot.getTime();
      while (t <= lastSlotMs) {
        if (t >= windowStart && t <= windowEnd) out.push(t);
        t += intervalMs;
      }
    }
    return out.sort((a, b) => a - b);
  }

  return baseTimes.sort((a, b) => a - b);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let sessionId = url.searchParams.get("session_id");
    let slug = url.searchParams.get("slug");
    if (!sessionId && !slug && req.method === "POST") {
      try {
        const body = await req.json();
        sessionId = body.session_id ?? sessionId;
        slug = body.slug ?? slug;
      } catch (_) { /* ignore */ }
    }
    if (!sessionId && !slug) return json({ error: "session_id or slug is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let q = supabase.from("live_sessions").select("*").limit(1);
    q = sessionId ? q.eq("id", sessionId) : q.eq("slug", slug!);
    const { data: session, error: sErr } = await q.maybeSingle();
    if (sErr || !session) return json({ error: "Session not found" }, 404);

    const now = Date.now();

    // Cancelled / unpublished short-circuit
    if (session.status === "cancelled") {
      return json({
        state: "cancelled" as State,
        session: trimSession(session),
        all_slots: [],
        seek_seconds: 0, seconds_until_next: 0,
        next_slot: null, current_slot_start: null, current_slot_end: null,
        replay_available: false, video_url: null, funnel_data: null,
        session_type: session.session_type,
      });
    }
    if (session.is_published === false) {
      return json({
        state: "unpublished" as State,
        session: trimSession(session),
        all_slots: [],
        seek_seconds: 0, seconds_until_next: 0,
        next_slot: null, current_slot_start: null, current_slot_end: null,
        replay_available: false, video_url: null, funnel_data: null,
        session_type: session.session_type,
      });
    }

    const isFunnelVideo = session.session_type === "funnel_video";

    // External link sessions: legacy behavior
    if (!isFunnelVideo) {
      return json({
        state: session.status === "live" ? "live" : session.status === "ended" ? "ended" : "waiting",
        seek_seconds: 0,
        next_slot: session.scheduled_at,
        current_slot_start: null,
        current_slot_end: null,
        seconds_until_next: session.scheduled_at
          ? Math.max(0, Math.floor((new Date(session.scheduled_at).getTime() - now) / 1000))
          : 0,
        replay_available: !!session.replay_enabled && !!session.replay_url,
        video_url: session.replay_url || null,
        meeting_url: session.meeting_url || null,
        funnel_data: null,
        session_type: "external_link",
        all_slots: session.scheduled_at ? [session.scheduled_at] : [],
        session: trimSession(session),
      });
    }

    // Resolve video URL + the real media duration. Keep this separate from the
    // scheduled slot duration so the player progress bar never uses a 60-minute
    // window as the "content length" for a shorter video.
    let videoUrl: string | null = null;
    let videoDuration: number | null = session.video_duration_seconds || null;
    let funnelData: Record<string, unknown> | null = null;

    if (session.funnel_id) {
      const { data: funnel } = await supabase
        .from("funnels")
        .select("id, title, slug, description, video_asset_id, thumbnail_url, speaker_mode, speaker_name, speaker_photo_url, speaker_about, owner_id, video_topics, video_topics_enabled, contact_whatsapp, contact_phone, cta_text, cta_url, cta_enabled")
        .eq("id", session.funnel_id)
        .maybeSingle();
      if (funnel) {
        funnelData = funnel;
        const vId = session.video_asset_id || funnel.video_asset_id;
        if (vId) {
          const { data: video } = await supabase
            .from("video_assets")
            .select("id, public_url, thumbnail_url, duration_seconds")
            .eq("id", vId)
            .maybeSingle();
          if (video) {
            videoUrl = video.public_url;
            videoDuration = video.duration_seconds || videoDuration || null;
          }
        }
      }
    }

    const duration = videoDuration ?? (session.duration_minutes ? session.duration_minutes * 60 : 3600);
    const slots = computeSlots(session, duration);

    const replayDelayMs = (session.replay_delay_minutes ?? session.replay_available_after_minutes ?? 0) * 60_000;
    const replayExpiresMs = session.replay_expires_hours ? session.replay_expires_hours * 3600_000 : null;
    const replayPerSlot = session.replay_per_slot !== false;

    let state: State = "waiting";
    let seekSeconds = 0;
    let currentSlotStart: number | null = null;
    let currentSlotEnd: number | null = null;
    let nextSlot: number | null = null;
    let secondsUntilNext = 0;

    // Find current live slot
    for (const start of slots) {
      const end = start + duration * 1000;
      if (now >= start && now <= end) {
        state = "live";
        currentSlotStart = start;
        currentSlotEnd = end;
        seekSeconds = Math.max(0, Math.floor((now - start) / 1000));
        break;
      }
    }

    if (state === "waiting") {
      const future = slots.find((s) => s > now);
      if (future) {
        nextSlot = future;
        secondsUntilNext = Math.max(0, Math.floor((future - now) / 1000));
        // Check whether per-slot replay of a recent past slot is available
        if (session.replay_enabled && replayPerSlot) {
          const lastPast = [...slots].reverse().find((s) => s + duration * 1000 < now);
          if (lastPast) {
            const replayStart = lastPast + duration * 1000 + replayDelayMs;
            const replayEnd = replayExpiresMs ? replayStart + replayExpiresMs : null;
            if (now >= replayStart && (replayEnd === null || now <= replayEnd) && videoUrl) {
              state = "replay";
            }
          }
        }
      } else {
        // All slots past
        const lastEnd = slots.length ? slots[slots.length - 1] + duration * 1000 : 0;
        if (session.replay_enabled && lastEnd) {
          const replayStart = lastEnd + replayDelayMs;
          const replayEnd = replayExpiresMs ? replayStart + replayExpiresMs : null;
          if (now >= replayStart && (replayEnd === null || now <= replayEnd) && videoUrl) {
            state = "replay";
          } else if (now < replayStart) {
            state = "ended";
            nextSlot = replayStart;
            secondsUntilNext = Math.max(0, Math.floor((replayStart - now) / 1000));
          } else {
            state = "ended";
          }
        } else {
          state = "ended";
        }
      }
    }

    // Real concurrent viewers (heartbeats in last 30s) for current/replay slot
    let concurrentViewers = 0;
    const slotForCount = currentSlotStart ?? (state === "replay" ? slots.filter((s) => s + duration * 1000 < now).slice(-1)[0] ?? null : null);
    if (slotForCount && session.show_viewer_count !== false) {
      try {
        const { data: cnt } = await supabase.rpc("get_live_concurrent_viewers", {
          _session_id: session.id,
          _session_slot: new Date(slotForCount).toISOString(),
        });
        concurrentViewers = typeof cnt === "number" ? cnt : 0;
      } catch (_) { /* ignore */ }
    }

    // Most recent slot that already finished (within last 7 days) — used to show
    // "Session just ended" copy in the waiting room between slots.
    const lastEndedSlotMs = [...slots]
      .reverse()
      .find((s) => s + duration * 1000 < now && now - (s + duration * 1000) < 7 * 86400_000) ?? null;

    return json({
      state,
      seek_seconds: seekSeconds,
      next_slot: nextSlot ? new Date(nextSlot).toISOString() : null,
      current_slot_start: currentSlotStart ? new Date(currentSlotStart).toISOString() : null,
      current_slot_end: currentSlotEnd ? new Date(currentSlotEnd).toISOString() : null,
      seconds_until_next: secondsUntilNext,
      replay_available: state === "replay" && !!videoUrl,
      last_ended_slot: lastEndedSlotMs ? new Date(lastEndedSlotMs).toISOString() : null,
      video_url: videoUrl,
      video_duration_seconds: videoDuration,
      funnel_data: funnelData,
      session_type: "funnel_video",
      all_slots: slots.slice(0, 60).map((t) => new Date(t).toISOString()),
      concurrent_viewers: concurrentViewers,
      session: trimSession(session),
    });
  } catch (err) {
    console.error("get-live-session-state error", err);
    return json({ error: "Internal error" }, 500);
  }
});

function trimSession(session: any) {
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    slug: session.slug,
    access_type: session.access_type,
    replay_enabled: session.replay_enabled,
    replay_per_slot: session.replay_per_slot,
    registration_count: session.registration_count,
    timezone: session.timezone,
    show_name: session.show_name,
    show_phone: session.show_phone,
    show_email: session.show_email,
    show_city: session.show_city,
    show_viewer_count: session.show_viewer_count,
    repeat_type: session.repeat_type,
    is_published: session.is_published,
    status: session.status,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
