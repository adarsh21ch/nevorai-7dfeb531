import { useEffect, useRef } from "react";
import { startVideoView, heartbeatVideoView } from "@/lib/videoTracking.functions";

type SourceType = "funnel" | "landing_page" | "live_session" | "video" | "other";

export interface VideoTrackingMeta {
  videoId: string;
  sourceType: SourceType;
  sourceId?: string | null;
}

const SESSION_KEY = "nv_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/**
 * Attach view tracking to an existing <video> element.
 * - Fires startVideoView on first play
 * - Sends heartbeats at 25%, 50%, 75% progress milestones
 * - Marks completed at >=80% watched or on the `ended` event
 */
export function useVideoTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  meta?: VideoTrackingMeta | null,
) {
  const eventIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const milestonesRef = useRef<Set<number>>(new Set());
  const completedRef = useRef(false);
  const maxPosRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !meta?.videoId) return;

    const start = async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        const res = await startVideoView({
          data: {
            videoId: meta.videoId,
            sessionId: getOrCreateSessionId(),
            durationSeconds: isFinite(v.duration) ? Math.floor(v.duration) : null,
            deviceType: detectDevice(),
            referrerSource: (typeof document !== "undefined" && document.referrer) || undefined,
          },
        });
        eventIdRef.current = res?.eventId ?? null;
      } catch (err) {
        console.debug("startVideoView failed:", err);
      }
    };

    const sendHeartbeat = (completed: boolean) => {
      const eventId = eventIdRef.current;
      if (!eventId) return;
      heartbeatVideoView({
        data: {
          eventId,
          watchPosition: Math.floor(v.currentTime || 0),
          maxPosition: Math.floor(maxPosRef.current),
          completed,
        },
      }).catch(() => {});
    };

    const onPlay = () => void start();

    const onTimeUpdate = () => {
      const cur = v.currentTime || 0;
      if (cur > maxPosRef.current) maxPosRef.current = cur;
      const dur = v.duration;
      if (!isFinite(dur) || dur <= 0) return;
      const pct = (cur / dur) * 100;
      for (const m of [25, 50, 75]) {
        if (pct >= m && !milestonesRef.current.has(m)) {
          milestonesRef.current.add(m);
          sendHeartbeat(false);
        }
      }
      if (pct >= 80 && !completedRef.current) {
        completedRef.current = true;
        sendHeartbeat(true);
      }
    };

    const onEnded = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      sendHeartbeat(true);
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef, meta?.videoId, meta?.sourceType, meta?.sourceId]);
}
