// Meta WhatsApp Cloud API webhook. (deploy v2)
//   GET  → token verification handshake
//   POST → inbound message → rule-based reply → Gemini fallback → send → log
//
// Reads phone_number_id, access_token, verify_token from whatsapp_settings.
// Stores every inbound + outbound message in whatsapp_conversations.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BRAND_NAME = "Nevorai";
const NEVORAI_APP_LINK = "https://nevorai.com";
const NEVORAI_CALL_LINK = "https://call.nevorai.com";
const NEVORAI_BASIC_PRICE = "₹149/month";
const NEVORAI_PRO_PRICE = "₹1,499/month";
const NEVORAI_TRIAL_TEXT = "Free trial is available for new users.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeText(message: string): string {
  return message.toLowerCase().trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function getRuleBasedReply(userMessage: string): string | null {
  const text = normalizeText(userMessage);

  if (includesAny(text, ["hi", "hello", "hii", "hey", "namaste"])) {
    return `Hi! Welcome to ${BRAND_NAME}. How can I help you today?`;
  }

  if (includesAny(text, [
    "what is nevorai", "about nevorai", "tell me about nevorai",
    "what is neverai", "about neverai", "tell me about neverai",
  ])) {
    return `${BRAND_NAME} has two main products:

1. ${BRAND_NAME}
A video funnel and lead capture platform for creators, entrepreneurs, and business owners.

2. ${BRAND_NAME} Call
A calling, lead tracking, follow-up, and team management platform.

You can visit: ${NEVORAI_APP_LINK}`;
  }

  if (includesAny(text, [
    "nevorai call", "neverai call", "call app", "calling app",
    "call tracking", "follow up", "follow-up", "team tracking", "lead calling",
  ])) {
    return `${BRAND_NAME} Call helps you upload leads, call them directly, tag leads, track follow-ups, manage team calling data, and use an AI assistant to understand your lead data.

Visit: ${NEVORAI_CALL_LINK}`;
  }

  if (includesAny(text, [
    "nevorai app", "neverai app", "video funnel", "funnel",
    "landing page", "forms", "lead capture", "video platform",
    "recorded live", "live session", "youtube", "prospect",
  ])) {
    return `${BRAND_NAME} helps creators, entrepreneurs, and business owners share focused video presentations with prospects.

It supports video funnels, landing pages, forms, lead capture, multi-step funnels, and recorded-live sessions.

Visit: ${NEVORAI_APP_LINK}`;
  }

  if (includesAny(text, [
    "product", "products", "service", "services", "features", "what do you offer",
  ])) {
    return `${BRAND_NAME} offers:

1. Video funnels and lead capture
2. Landing pages and forms
3. Recorded-live sessions
4. WhatsApp automation
5. Lead calling and follow-up tracking
6. Team tracking and AI lead assistant`;
  }

  if (includesAny(text, [
    "price", "pricing", "cost", "plan", "plans", "subscription", "charges", "fees",
  ])) {
    return `${BRAND_NAME} pricing:

Basic: ${NEVORAI_BASIC_PRICE}
Pro: ${NEVORAI_PRO_PRICE}

${NEVORAI_TRIAL_TEXT}

Please tell me which product you are interested in: ${BRAND_NAME} or ${BRAND_NAME} Call?`;
  }

  if (includesAny(text, [
    "demo", "book demo", "meeting", "call me", "talk to team", "contact team",
  ])) {
    return `Sure, we can arrange a demo. Please share your name, business type, and preferred time.`;
  }

  if (includesAny(text, [
    "support", "issue", "problem", "not working", "error", "help", "stuck",
  ])) {
    return `Sure, please describe the issue you are facing. If possible, share a screenshot or short details, and our team will help you shortly.`;
  }

  if (includesAny(text, [
    "link", "website", "app link", "login", "signup", "sign up",
  ])) {
    return `${BRAND_NAME} links:

Main platform: ${NEVORAI_APP_LINK}
${BRAND_NAME} Call: ${NEVORAI_CALL_LINK}`;
  }

  return null;
}

function buildGeminiPrompt(userMessage: string): string {
  return `You are ${BRAND_NAME}'s WhatsApp assistant.

Your job:
Help users understand ${BRAND_NAME} in simple English and collect useful details for the team.

Language style:
- Use simple English.
- Keep replies short.
- Use 2 to 5 short lines maximum.
- Do not use technical or heavy words.
- Do not sound robotic.
- Do not introduce yourself again and again.
- Do not mention network marketing.
- Use words like creators, entrepreneurs, business owners, prospects, leads, and teams.

Truth rules:
- Do not invent features, prices, offers, discounts, guarantees, clients, or timelines.
- Do not promise anything that is not written below.
- If unsure, say the team will guide them.
- If user asks pricing, use only the pricing written below.
- If user asks for demo, ask for name, business type, and preferred time.
- If user has an issue, ask them to share details or screenshot.

Product 1: ${BRAND_NAME}
${BRAND_NAME} is a video funnel and lead capture platform for creators, entrepreneurs, and business owners.
It helps users share focused video presentations with prospects.
It supports: video funnels, landing pages, forms, lead capture, multi-step funnels, recorded-live sessions.

Product 1 link: ${NEVORAI_APP_LINK}

Product 2: ${BRAND_NAME} Call
${BRAND_NAME} Call helps users upload leads, call leads directly, tag leads, track follow-ups, see calling data, manage team data, and use an AI assistant to understand lead data.

Product 2 link: ${NEVORAI_CALL_LINK}

Pricing:
Basic: ${NEVORAI_BASIC_PRICE}
Pro: ${NEVORAI_PRO_PRICE}
Trial: ${NEVORAI_TRIAL_TEXT}

Now reply to this user message:
${userMessage}`;
}

interface GeminiResult {
  reply: string;
  model: string | null;
  fallback: boolean;
}

async function askGemini(userMessage: string): Promise<GeminiResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      reply: `Thanks for your message. The ${BRAND_NAME} team will get back to you shortly.`,
      model: null,
      fallback: true,
    };
  }

  const models = ["gemini-2.5-flash-lite", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildGeminiPrompt(userMessage) }] }],
          }),
        },
      );

      const result = await response.json();
      console.log(`Gemini response from ${model}:`, JSON.stringify(result).slice(0, 500));

      if (!result.error) {
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { reply: text, model, fallback: false };
      }

      // 503/429 → try next model. Other errors → give up.
      if (result.error && ![503, 429].includes(result.error.code)) {
        break;
      }
    } catch (e) {
      console.error(`Gemini request failed for ${model}:`, (e as Error).message);
    }
  }

  return {
    reply: `Thanks for your message. The ${BRAND_NAME} team has received it and will get back to you shortly.`,
    model: null,
    fallback: true,
  };
}

interface WhatsAppSettings {
  phone_number_id: string | null;
  access_token: string | null;
  verify_token: string | null;
  is_connected: boolean;
}

async function loadSettings(supabase: SupabaseClient): Promise<WhatsAppSettings | null> {
  const { data } = await supabase
    .from("whatsapp_settings")
    .select("phone_number_id, access_token, verify_token, is_connected")
    .limit(1)
    .maybeSingle();
  return data as WhatsAppSettings | null;
}

async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string,
): Promise<{ ok: boolean; metaMessageId: string | null; error: string | null }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body },
        }),
      },
    );
    const result = await res.json();
    if (!res.ok) {
      return { ok: false, metaMessageId: null, error: JSON.stringify(result?.error || result).slice(0, 500) };
    }
    return { ok: true, metaMessageId: result?.messages?.[0]?.id ?? null, error: null };
  } catch (e) {
    return { ok: false, metaMessageId: null, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── GET: Meta webhook verification ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const settings = await loadSettings(supabase);
    const expectedToken = settings?.verify_token || "nevorai123";

    if (mode === "subscribe" && token === expectedToken && challenge) {
      console.log("WEBHOOK VERIFIED");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: incoming WhatsApp message ──
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Acknowledge fast — Meta retries if we take >20s
  const respond = () => new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });

  try {
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== "text") {
      return respond();
    }

    const from: string = message.from;
    const userText: string = message.text?.body || "";
    const inboundMetaId: string | null = message.id || null;

    console.log("Message from:", from, "Text:", userText);

    // Log inbound
    await supabase.from("whatsapp_conversations").insert({
      phone_number: from,
      direction: "inbound",
      message_body: userText,
      message_type: "text",
      meta_message_id: inboundMetaId,
      status: "received",
      raw_payload: payload,
    });

    const settings = await loadSettings(supabase);
    if (!settings || !settings.is_connected || !settings.phone_number_id || !settings.access_token) {
      console.error("WhatsApp settings not configured — cannot reply");
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        direction: "outbound",
        message_body: null,
        status: "skipped",
        reply_method: "none",
        error_message: "WhatsApp not configured in whatsapp_settings",
      });
      return respond();
    }

    // Decide reply
    const ruleReply = getRuleBasedReply(userText);
    let replyText: string;
    let replyMethod: "rule_based" | "ai";
    let aiModel: string | null = null;

    if (ruleReply) {
      replyText = ruleReply;
      replyMethod = "rule_based";
    } else {
      const ai = await askGemini(userText);
      replyText = ai.reply;
      replyMethod = "ai";
      aiModel = ai.model;
    }

    const sendResult = await sendWhatsAppText(
      settings.phone_number_id,
      settings.access_token,
      from,
      replyText,
    );

    // Log outbound
    await supabase.from("whatsapp_conversations").insert({
      phone_number: from,
      direction: "outbound",
      message_body: replyText,
      message_type: "text",
      meta_message_id: sendResult.metaMessageId,
      status: sendResult.ok ? "sent" : "failed",
      reply_method: replyMethod,
      ai_model: aiModel,
      error_message: sendResult.error,
    });

    return respond();
  } catch (error) {
    console.error("Webhook error:", (error as Error).message);
    return respond();
  }
});
