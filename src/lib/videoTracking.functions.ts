import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const StartSchema = z.object({
  videoId: z.string().uuid(),
  sessionId: z.string().min(8).max(64),
  durationSeconds: z.number().nullable().optional(),
  deviceType: z.string().max(20).optional(),
  referrerSource: z.string().max(255).optional(),
});

const HeartbeatSchema = z.object({
  eventId: z.string().uuid(),
  watchPosition: z.number().min(0).max(100000),
  maxPosition: z.number().min(0).max(100000),
  completed: z.boolean().optional(),
  skipAttempts: z.number().int().min(0).max(10000).optional(),
});

export const startVideoView = createServerFn({ method: "POST" })
  .inputValidator((input) => StartSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("video_view_events" as any)
      .insert({
        video_id: data.videoId,
        session_id: data.sessionId,
        duration_seconds: data.durationSeconds ?? null,
        device_type: data.deviceType ?? null,
        referrer_source: data.referrerSource ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("startVideoView error:", error.message);
      return { eventId: null as string | null };
    }
    return { eventId: (row as any).id as string };
  });

export const heartbeatVideoView = createServerFn({ method: "POST" })
  .inputValidator((input) => HeartbeatSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("video_view_events" as any)
      .update({
        watch_position_seconds: data.watchPosition,
        max_position_seconds: data.maxPosition,
        completed: data.completed ?? false,
        skip_attempts: data.skipAttempts ?? 0,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", data.eventId);
    if (error) console.error("heartbeatVideoView error:", error.message);
    return { ok: !error };
  });
