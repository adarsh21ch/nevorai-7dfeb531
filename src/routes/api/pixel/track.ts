import { createFileRoute } from "@tanstack/react-router";

const PIXEL_ID = "1293470716241461";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/pixel/track")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        const token = process.env.META_CAPI_ACCESS_TOKEN;
        if (!token) {
          // Soft-success so client never blocks on missing config.
          return new Response(
            JSON.stringify({ ok: false, reason: "no_token" }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, reason: "bad_json" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }

        const { event, eventID, params = {}, eventSourceUrl, userAgent } = body ?? {};
        if (!event || !eventID) {
          return new Response(JSON.stringify({ ok: false, reason: "bad_payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        }

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("cf-connecting-ip") ||
          "";

        const userData: Record<string, string> = {};
        if (ip) userData.client_ip_address = ip;
        if (userAgent) userData.client_user_agent = userAgent;
        if (params.email) userData.em = await sha256(String(params.email));
        if (params.phone) userData.ph = await sha256(String(params.phone));
        if (params.user_id) userData.external_id = await sha256(String(params.user_id));

        const payload = {
          data: [
            {
              event_name: event,
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventID,
              action_source: "website",
              event_source_url: eventSourceUrl,
              user_data: userData,
              custom_data: {
                value: params.value,
                currency: params.currency,
                content_name: params.content_name,
                content_category: params.content_category,
                content_ids: params.content_ids,
                order_id: params.order_id,
              },
            },
          ],
        };

        try {
          const resp = await fetch(
            `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${token}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const json = await resp.json().catch(() => ({}));
          return new Response(JSON.stringify({ ok: resp.ok, meta: json }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          });
        } catch (err: any) {
          console.error("[pixel-track] CAPI failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: err?.message ?? "unknown" }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
          );
        }
      },
    },
  },
});
