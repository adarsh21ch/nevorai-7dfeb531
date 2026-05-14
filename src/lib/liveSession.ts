// Shared utilities for live sessions: slot computation, calendar export, status

export type RepeatType = "once" | "daily" | "interval" | "custom";
export type LiveStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";

export interface LiveSessionLike {
  scheduled_times?: unknown;
  repeat_type?: string | null;
  repeat_interval_hours?: number | null;
  repeat_window_start?: string | null;
  repeat_window_end?: string | null;
  repeat_end_date?: string | null;
  duration_minutes?: number | null;
  video_duration_seconds?: number | null;
  status?: string | null;
  is_published?: boolean | null;
  replay_enabled?: boolean | null;
  replay_per_slot?: boolean | null;
  replay_delay_minutes?: number | null;
  replay_expires_hours?: number | null;
}

export const sessionDurationSec = (s: LiveSessionLike) =>
  s.video_duration_seconds || (s.duration_minutes ? s.duration_minutes * 60 : 3600);

export function computeSessionSlots(session: LiveSessionLike): number[] {
  const repeat = (session.repeat_type as RepeatType) || "once";
  const rawTimes = Array.isArray(session.scheduled_times) ? (session.scheduled_times as unknown[]) : [];
  const baseTimes = rawTimes
    .map((t) => new Date(String(t)).getTime())
    .filter((t) => !isNaN(t));

  if (repeat === "once" || repeat === "custom") return [...baseTimes].sort((a, b) => a - b);
  if (baseTimes.length === 0) return [];

  const base = baseTimes[0];
  const baseDate = new Date(base);
  const endDate = session.repeat_end_date
    ? new Date(session.repeat_end_date + "T23:59:59").getTime()
    : null;

  const now = Date.now();
  const windowStart = now - 2 * 86400_000;
  const windowEnd = Math.min(now + 60 * 86400_000, endDate ?? Number.POSITIVE_INFINITY);

  const out: number[] = [];
  if (repeat === "daily") {
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
    const parseHM = (s?: string | null) => {
      if (!s) return null;
      const [h, m] = s.split(":").map((x) => parseInt(x, 10));
      return { h: h || 0, m: m || 0 };
    };
    const wStart = parseHM(session.repeat_window_start);
    const wEnd = parseHM(session.repeat_window_end);
    const startDay = new Date(windowStart);
    startDay.setHours(0, 0, 0, 0);
    for (let d = startDay.getTime(); d <= windowEnd; d += 86400_000) {
      const day = new Date(d);
      const firstSlot = new Date(day);
      if (wStart) firstSlot.setHours(wStart.h, wStart.m, 0, 0);
      else firstSlot.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
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

export function nextSlot(session: LiveSessionLike): number | null {
  const now = Date.now();
  const slots = computeSessionSlots(session);
  return slots.find((s) => s > now) ?? null;
}

export function currentLiveSlot(session: LiveSessionLike): number | null {
  const dur = sessionDurationSec(session) * 1000;
  const now = Date.now();
  const slots = computeSessionSlots(session);
  return slots.find((s) => now >= s && now <= s + dur) ?? null;
}

export function effectiveStatus(session: LiveSessionLike): LiveStatus | "replay" | "unpublished" {
  if (session.status === "cancelled") return "cancelled";
  if (session.is_published === false) return "unpublished";
  if (session.status === "draft") return "draft";
  if (currentLiveSlot(session)) return "live";
  if (nextSlot(session)) return "scheduled";
  if (session.replay_enabled) return "replay";
  return "ended";
}

const pad = (n: number) => String(n).padStart(2, "0");
const toICSDate = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function googleCalendarUrl(opts: {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  url: string;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${toICSDate(opts.start)}/${toICSDate(opts.end)}`,
    details: `${opts.description || ""}\n\nJoin: ${opts.url}`,
    location: opts.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildICS(opts: {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  url: string;
  uid: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//nFlow by Nevorai//Live Sessions//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@nFlow by Nevorai`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(opts.start)}`,
    `DTEND:${toICSDate(opts.end)}`,
    `SUMMARY:${escapeICS(opts.title)}`,
    `DESCRIPTION:${escapeICS((opts.description || "") + "\\n\\nJoin: " + opts.url)}`,
    `URL:${opts.url}`,
    `LOCATION:${opts.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function escapeICS(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
