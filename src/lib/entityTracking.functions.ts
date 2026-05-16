import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EntityType = z.enum(["funnel", "landing_page", "live_session"]);

const TABLE_BY_ENTITY: Record<string, { table: string; idCol: string }> = {
  funnel: { table: "funnel_view_events", idCol: "funnel_id" },
  landing_page: { table: "landing_page_view_events", idCol: "landing_page_id" },
  live_session: { table: "live_session_view_events", idCol: "live_session_id" },
};

const StartSchema = z.object({
  entityType: EntityType,
  entityId: z.string().uuid(),
  sessionId: z.string().min(8).max(64),
  deviceType: z.string().max(20).optional(),
  referrerSource: z.string().max(255).optional(),
});

const HeartbeatSchema = z.object({
  entityType: EntityType,
  eventId: z.string().uuid(),
});

export const startEntityView = createServerFn({ method: "POST" })
  .inputValidator((input) => StartSchema.parse(input))
  .handler(async ({ data }) => {
    const meta = TABLE_BY_ENTITY[data.entityType];
    const { data: row, error } = await supabaseAdmin
      .from(meta.table as any)
      .insert({
        [meta.idCol]: data.entityId,
        session_id: data.sessionId,
        device_type: data.deviceType ?? null,
        referrer_source: data.referrerSource ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("startEntityView error:", error.message);
      return { eventId: null as string | null };
    }
    return { eventId: (row as any).id as string };
  });

export const heartbeatEntityView = createServerFn({ method: "POST" })
  .inputValidator((input) => HeartbeatSchema.parse(input))
  .handler(async ({ data }) => {
    const meta = TABLE_BY_ENTITY[data.entityType];
    const { error } = await supabaseAdmin
      .from(meta.table as any)
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", data.eventId);
    if (error) console.error("heartbeatEntityView error:", error.message);
    return { ok: !error };
  });
