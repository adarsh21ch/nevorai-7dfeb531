// Meta WhatsApp Cloud API webhook for Nevorai. (deploy v3 — Phase 1: intents + memory + user-aware)
//   GET  → token verification handshake
//   POST → inbound message → user lookup → rule-based reply or Gemini AI (with memory) → send → log
//
// Phase 1 features:
//   - 30+ intents covering greetings, products, pricing, support, account, etc.
//   - Phone-to-user lookup (profiles.phone or whatsapp_number)
//   - Conversation memory (last 10 messages fed to Gemini for context-aware replies)
//   - Branching Gemini prompt for known users vs unknown prospects
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BRAND_NAME = "Nevorai";
const NEVORAI_APP_LINK = "https://nevorai.com";
const NEVORAI_CALL_LINK = "https://call.nevorai.com";
const NEVORAI_BASIC_PRICE = "₹149/month";
const NEVORAI_PRO_PRICE = "₹1,499/month";
const NEVORAI_TRIAL_TEXT = "Free trial is available for new users.";
const SUPPORT_EMAIL = "teamnevorai@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/919329040508";

const CONVERSATION_HISTORY_LIMIT = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── User context ────────────────────────────────────────────────
interface UserContext {
  isKnown: boolean;
  userId: string | null;
  name: string | null;
  email: string | null;
  plan: string | null;
}

async function lookupUserByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<UserContext> {
  // Normalize: try with and without country code prefix
  const cleaned = phone.replace(/\D/g, "");
  const withoutCountry = cleaned.length > 10 ? cleaned.slice(-10) : cleaned;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, subscription_status, phone, whatsapp_number")
    .or(
      `phone.eq.${cleaned},phone.eq.${withoutCountry},whatsapp_number.eq.${cleaned},whatsapp_number.eq.${withoutCountry}`,
    )
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { isKnown: false, userId: null, name: null, email: null, plan: null };
  }

  return {
    isKnown: true,
    userId: data.id,
    name: data.full_name,
    email: data.email,
    plan: data.subscription_status || "free",
  };
}

// ─── Intent system ───────────────────────────────────────────────
function normalizeText(message: string): string {
  return message.toLowerCase().trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

interface Intent {
  match: (text: string) => boolean;
  reply: (ctx: UserContext) => string;
}

const INTENTS: Intent[] = [
  // ── Greetings ─────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["hi", "hello", "hii", "hey", "namaste", "hola", "good morning", "good evening", "good afternoon"]),
    reply: (ctx) => ctx.isKnown && ctx.name
      ? `Hi ${ctx.name.split(" ")[0]}! Welcome back to ${BRAND_NAME}. How can I help you today?`
      : `Hi! Welcome to ${BRAND_NAME}. How can I help you today?`,
  },

  // ── Thanks ────────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["thanks", "thank you", "thx", "ty", "shukriya", "dhanyawad"]),
    reply: () => `You're welcome! Let me know if you need anything else.`,
  },

  // ── Goodbye ───────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["bye", "goodbye", "see you", "see ya", "alvida"]),
    reply: () => `Goodbye! Reach out anytime you have questions about ${BRAND_NAME}.`,
  },

  // ── About Nevorai ─────────────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "what is nevorai", "about nevorai", "tell me about nevorai",
      "what is neverai", "about neverai", "tell me about neverai",
      "what do you do", "what does nevorai do",
    ]),
    reply: () => `${BRAND_NAME} has two main products:

1. ${BRAND_NAME}
A video funnel and lead capture platform for creators, entrepreneurs, and business owners.

2. ${BRAND_NAME} Call
A calling, lead tracking, follow-up, and team management platform.

Visit: ${NEVORAI_APP_LINK}`,
  },

  // ── Nevorai Call ──────────────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "nevorai call", "neverai call", "call app", "calling app",
      "call tracking", "follow up", "follow-up", "team tracking", "lead calling",
    ]),
    reply: () => `${BRAND_NAME} Call helps you upload leads, call them directly, tag leads, track follow-ups, manage team calling data, and use an AI assistant to understand lead data.

Visit: ${NEVORAI_CALL_LINK}`,
  },

  // ── Nevorai App / Video funnel ────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "nevorai app", "neverai app", "video funnel", "funnel",
      "landing page", "forms", "lead capture", "video platform",
      "recorded live", "live session", "youtube", "prospect",
    ]),
    reply: () => `${BRAND_NAME} helps creators, entrepreneurs, and business owners share focused video presentations with prospects.

It supports video funnels, landing pages, forms, lead capture, multi-step funnels, and recorded-live sessions.

Visit: ${NEVORAI_APP_LINK}`,
  },

  // ── Products / features ───────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "product", "products", "service", "services", "features", "what do you offer", "feature list",
    ]),
    reply: () => `${BRAND_NAME} offers:

1. Video funnels and lead capture
2. Landing pages and forms
3. Recorded-live sessions
4. WhatsApp automation
5. Lead calling and follow-up tracking
6. Team tracking and AI lead assistant`,
  },

  // ── Compare plans (MUST come before Pricing) ──────────────────
  {
    match: (t) => includesAny(t, ["compare plan", "compare plans", "basic vs pro", "difference between", "which plan", "best plan", "pro vs basic", "plan comparison"]),
    reply: () => `Quick comparison:

Basic (${NEVORAI_BASIC_PRICE}): For getting started with video funnels and lead capture. Lower view limits.

Pro (${NEVORAI_PRO_PRICE}): For growing businesses. Higher view limits, more funnels, advanced analytics, and priority support.

Visit ${NEVORAI_APP_LINK}/pricing for full details.`,
  },

  // ── Free trial (MUST come before Pricing) ─────────────────────
  {
    match: (t) => includesAny(t, ["free trial", "trial", "try free", "free version", "try it", "trial period", "trial duration"]),
    reply: () => `Yes! ${BRAND_NAME} offers a free trial for new users. Sign up at ${NEVORAI_APP_LINK} and you can explore the platform before subscribing.`,
  },

  // ── Yearly / annual (MUST come before Pricing) ────────────────
  {
    match: (t) => includesAny(t, ["yearly", "annual", "year plan", "annual plan", "12 month", "annual discount", "yearly discount"]),
    reply: () => `${BRAND_NAME} offers yearly plans with a discount over monthly pricing. Check ${NEVORAI_APP_LINK}/pricing for the current yearly rates.`,
  },

  // ── Discount / offer (MUST come before Pricing) ───────────────
  {
    match: (t) => includesAny(t, ["discount", "coupon", "promo", "offer", "promo code", "discount code", "cheaper", "save money"]),
    reply: () => `We run occasional offers. The biggest saving today is the yearly plan vs monthly. For special discounts, share your business type and our team will see what we can do.`,
  },

  // ── Pricing ───────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "price", "pricing", "cost", "plan", "plans", "subscription", "charges", "fees", "how much",
    ]),
    reply: () => `${BRAND_NAME} pricing:

Basic: ${NEVORAI_BASIC_PRICE}
Pro: ${NEVORAI_PRO_PRICE}

${NEVORAI_TRIAL_TEXT}

Which product are you interested in: ${BRAND_NAME} or ${BRAND_NAME} Call?`,
  },

  // ── Payment / Razorpay ────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["payment", "razorpay", "pay now", "checkout", "buy", "purchase"]),
    reply: (ctx) => ctx.isKnown
      ? `You can manage your subscription at ${NEVORAI_APP_LINK}/billing. If you face payment issues, share the details and our team will help.`
      : `Sign up first at ${NEVORAI_APP_LINK}, then choose a plan and pay securely via Razorpay (UPI, cards, net banking).`,
  },

  // ── Invoice / receipt ─────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["invoice", "receipt", "bill", "billing history", "tax receipt"]),
    reply: (ctx) => ctx.isKnown
      ? `You can download invoices from ${NEVORAI_APP_LINK}/billing. If you need one emailed, share your order date and we'll arrange it.`
      : `Once you're a paying user, all invoices are available at ${NEVORAI_APP_LINK}/billing.`,
  },

  // ── Refund ────────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["refund", "money back", "return", "want refund"]),
    reply: () => `Sure, refund requests are handled case-by-case. Please share your registered email and the reason, and our team will respond within 24 hours.`,
  },

  // ── Cancel / unsubscribe ──────────────────────────────────────
  {
    match: (t) => includesAny(t, ["cancel", "unsubscribe", "stop subscription", "end plan", "deactivate account"]),
    reply: (ctx) => ctx.isKnown
      ? `You can cancel your subscription from ${NEVORAI_APP_LINK}/billing. Need help? Just share your registered email.`
      : `If you're a paying user, go to ${NEVORAI_APP_LINK}/billing to cancel anytime.`,
  },

  // ── Renewal ───────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["renew", "extend plan", "subscription expired", "expire", "expiring"]),
    reply: () => `You can renew your plan anytime at ${NEVORAI_APP_LINK}/billing. Need help with renewal? Share your registered email.`,
  },

  // ── Upgrade ───────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["upgrade", "move to pro", "switch plan", "change plan"]),
    reply: () => `You can upgrade anytime from ${NEVORAI_APP_LINK}/upgrade. We use fair prorated pricing — you only pay the difference for the remaining days.`,
  },

  // ── Demo ──────────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "demo", "book demo", "meeting", "call me", "talk to team", "contact team", "schedule call", "book a call",
    ]),
    reply: () => `Sure, we can arrange a demo. Please share:
1. Your name
2. Business type
3. Preferred time

Our team will reach out to confirm.`,
  },

  // ── Talk to human ─────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["talk to human", "real person", "human agent", "speak to someone", "live agent", "team member"]),
    reply: () => `Sure, our team will reach out shortly. Meanwhile, you can also contact us at ${SUPPORT_EMAIL} or via WhatsApp at ${SUPPORT_WHATSAPP}.`,
  },

  // ── Support / issues ──────────────────────────────────────────
  {
    match: (t) => includesAny(t, [
      "support", "issue", "problem", "not working", "error", "help", "stuck", "bug", "broken", "crash",
    ]),
    reply: () => `Sure, please describe the issue you are facing. If possible, share a screenshot or a short video, and our team will help you shortly.`,
  },

  // ── Login / signup issues ─────────────────────────────────────
  {
    match: (t) => includesAny(t, ["login", "log in", "can't login", "cant login", "sign in", "signin"]),
    reply: () => `Sign in at ${NEVORAI_APP_LINK}/auth. If you can't log in, share the email you used and what error you see — we'll help fix it.`,
  },

  {
    match: (t) => includesAny(t, ["signup", "sign up", "create account", "register"]),
    reply: () => `Create your free account at ${NEVORAI_APP_LINK}/auth. Takes under a minute. You get a free trial right after signup.`,
  },

  {
    match: (t) => includesAny(t, ["forgot password", "reset password", "password reset", "can't remember password"]),
    reply: () => `Reset your password at ${NEVORAI_APP_LINK}/auth — click "Forgot password" and follow the email instructions.`,
  },

  // ── Account info ──────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["my account", "my plan", "my subscription", "account info", "account status"]),
    reply: (ctx) => ctx.isKnown
      ? `Hi ${ctx.name?.split(" ")[0] || "there"}, you can see your full account details at ${NEVORAI_APP_LINK}/profile. (Detailed info via WhatsApp is coming soon.)`
      : `It looks like you're not signed up yet. Create your account at ${NEVORAI_APP_LINK}/auth to get started.`,
  },

  // ── Views / limits ────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["views", "view limit", "daily views", "monthly views", "how many views"]),
    reply: (ctx) => ctx.isKnown
      ? `You can see your daily and monthly view usage at ${NEVORAI_APP_LINK}/dashboard. Need a top-up? Visit ${NEVORAI_APP_LINK}/billing.`
      : `${BRAND_NAME} has tiered view limits depending on your plan. Visit ${NEVORAI_APP_LINK}/pricing for details.`,
  },

  // ── Storage ───────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["storage", "storage limit", "space full", "video upload size"]),
    reply: () => `Storage limits depend on your plan. Basic includes a smaller quota; Pro gives you much more. Check ${NEVORAI_APP_LINK}/pricing for current limits.`,
  },

  // ── Upload help ───────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["upload video", "how to upload", "video not uploading", "upload fail"]),
    reply: () => `To upload: go to ${NEVORAI_APP_LINK}/videos → click "Upload". If upload fails, share the file format, size, and the error message — our team will help.`,
  },

  // ── Funnel creation help ──────────────────────────────────────
  {
    match: (t) => includesAny(t, ["create funnel", "how to make funnel", "funnel builder", "build funnel"]),
    reply: () => `Create your first funnel at ${NEVORAI_APP_LINK}/funnels/create. It's a step-by-step builder — add video, add lead form, share the link. Takes a few minutes.`,
  },

  // ── Landing page help ─────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["create landing", "how to make landing page", "landing builder"]),
    reply: () => `You can create landing pages at ${NEVORAI_APP_LINK}/landing-pages/create. Easy drag-and-drop. Available on Pro plan.`,
  },

  // ── WhatsApp automation ───────────────────────────────────────
  {
    match: (t) => includesAny(t, ["whatsapp automation", "auto whatsapp", "whatsapp message automation"]),
    reply: () => `${BRAND_NAME} supports automated WhatsApp messages for events like new leads, trial expiry, payment failures, and more. Configure in your admin settings once you're a paid user.`,
  },

  // ── Affiliate / referral ──────────────────────────────────────
  {
    match: (t) => includesAny(t, ["affiliate", "referral", "partner", "earn money", "commission"]),
    reply: () => `Our affiliate/partner program is in the works. Share your name and email and we'll add you to the waitlist.`,
  },

  // ── Tutorial / how to use ─────────────────────────────────────
  {
    match: (t) => includesAny(t, ["tutorial", "how to use", "getting started", "guide", "documentation", "docs", "manual", "walkthrough", "training"]),
    reply: () => `You can find tutorials inside the app at ${NEVORAI_APP_LINK} once logged in. We also share quick guides on our Instagram and YouTube. Want a personal walkthrough? Just ask for a demo.`,
  },

  // ── Mobile app ────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["mobile app", "android app", "ios app", "iphone app", "play store", "app store", "download app"]),
    reply: () => `${BRAND_NAME} works on mobile through the browser at ${NEVORAI_APP_LINK} — fully responsive. A native mobile app is on our roadmap.`,
  },

  // ── API / integration ────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["api", "integration", "zapier", "webhook", "developer", "rest api", "third party", "connect with"]),
    reply: () => `We're working on a public API and integrations. Share what you'd like to connect with (CRM, sheets, etc.) and our team will see if there's a workaround today.`,
  },

  // ── GST / tax invoice ─────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["gst", "gst invoice", "tax invoice", "company invoice", "business invoice", "b2b invoice", "company name on invoice"]),
    reply: () => `Yes, we issue GST invoices. Share your registered email, company name, and GSTIN, and our team will send you a proper tax invoice.`,
  },

  // ── Custom domain ─────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["custom domain", "my own domain", "subdomain", "branded url", "custom url"]),
    reply: () => `Custom domains are supported on higher plans. After subscribing, you can add your domain from settings. Need help with DNS? Our team will guide you.`,
  },

  // ── Whitelabel ────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["whitelabel", "white label", "white-label", "remove branding", "remove watermark", "hide nevorai logo"]),
    reply: () => `Whitelabel/branding removal is available on Pro and above. Once you upgrade, you can hide the "Made with ${BRAND_NAME}" watermark from your funnels and landing pages.`,
  },

  // ── Data export / backup ──────────────────────────────────────
  {
    match: (t) => includesAny(t, ["export data", "download data", "backup", "csv export", "export leads", "data download"]),
    reply: () => `You can export your leads and funnel data as CSV from your dashboard. Higher plans get higher monthly export limits.`,
  },

  // ── Security / privacy ────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["security", "privacy", "data privacy", "gdpr", "data protection", "is it safe", "secure"]),
    reply: () => `${BRAND_NAME} stores your data on secure cloud infrastructure with encryption. We do not sell or share your data. Full policy at ${NEVORAI_APP_LINK}/privacy.`,
  },

  // ── Time zone ─────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["time zone", "timezone", "ist", "indian time", "indian standard time"]),
    reply: () => `${BRAND_NAME} runs on IST (Indian Standard Time) for daily/monthly view counting and renewals.`,
  },

  // ── Hindi / language ──────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["hindi", "language", "vernacular", "regional"]),
    reply: () => `${BRAND_NAME} app is in English for now. Hindi support is on our roadmap. You can chat with our team in Hindi via WhatsApp anytime.`,
  },

  // ── Short acks (OK / yes / no) ────────────────────────────────
  {
    match: (t) => /^(ok|okay|k|kk|👍|hmm|hmmm|sure|alright|cool|nice|great)\.?$/i.test(t),
    reply: () => `Got it! Let me know what you'd like to do next — pricing, demo, signup, or any specific question.`,
  },

  {
    match: (t) => /^(yes|yeah|yep|haan|ji|ji haan|sahi|right)\.?$/i.test(t),
    reply: () => `Great! What would you like to do next? You can ask about pricing, book a demo, or sign up at ${NEVORAI_APP_LINK}.`,
  },

  {
    match: (t) => /^(no|nope|nah|nahi)\.?$/i.test(t),
    reply: () => `No problem. Let me know if you have any other questions about ${BRAND_NAME}.`,
  },

  // ── Contact info ──────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["email", "mail id", "contact email", "your email"]),
    reply: () => `You can email us at ${SUPPORT_EMAIL} — we usually reply within a few hours.`,
  },

  {
    match: (t) => includesAny(t, ["phone", "call you", "phone number", "contact number"]),
    reply: () => `Our team is reachable on WhatsApp at ${SUPPORT_WHATSAPP}. Send a message and someone will respond shortly.`,
  },

  {
    match: (t) => includesAny(t, ["location", "address", "office", "where are you", "based in"]),
    reply: () => `${BRAND_NAME} is based in India 🇮🇳. We serve creators and businesses across India and globally.`,
  },

  // ── Links ─────────────────────────────────────────────────────
  {
    match: (t) => includesAny(t, ["link", "website", "app link", "url"]),
    reply: () => `${BRAND_NAME} links:

Main platform: ${NEVORAI_APP_LINK}
${BRAND_NAME} Call: ${NEVORAI_CALL_LINK}`,
  },
];

function getRuleBasedReply(userMessage: string, ctx: UserContext): string | null {
  const text = normalizeText(userMessage);
  for (const intent of INTENTS) {
    if (intent.match(text)) return intent.reply(ctx);
  }
  return null;
}

// ─── Conversation memory ─────────────────────────────────────────
interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

async function getRecentHistory(
  supabase: SupabaseClient,
  phone: string,
  limit: number,
): Promise<ChatTurn[]> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("direction, message_body, created_at")
    .eq("phone_number", phone)
    .not("message_body", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data
    .reverse()
    .map((row) => ({
      role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      text: row.message_body as string,
    }));
}

// ─── Gemini AI ───────────────────────────────────────────────────
function buildGeminiPrompt(
  userMessage: string,
  ctx: UserContext,
  history: ChatTurn[],
): string {
  const userBlock = ctx.isKnown
    ? `You are speaking with an existing ${BRAND_NAME} user. Be warm and helpful.
User name: ${ctx.name || "Unknown"}
Plan status: ${ctx.plan || "unknown"}
Treat them as a customer who already trusts the product. Avoid pitching from scratch. Focus on helping them with their question or directing them to the right page.`
    : `You are speaking with someone who is NOT yet a ${BRAND_NAME} user (a prospect). Be welcoming, explain things simply, and guide them toward signing up if relevant. Do not assume they know ${BRAND_NAME} already.`;

  const historyBlock = history.length === 0
    ? "(No prior messages in this chat.)"
    : history
        .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`)
        .join("\n");

  return `You are ${BRAND_NAME}'s WhatsApp assistant.

${userBlock}

Language and style:
- Use simple English.
- Keep replies short — 2 to 5 short lines.
- Do not use heavy or technical words.
- Do not introduce yourself again every reply.
- Do not mention network marketing.
- Use words like creators, entrepreneurs, business owners, prospects, leads, teams.

Truth rules:
- Do not invent features, prices, offers, discounts, guarantees, clients, or timelines.
- If unsure, say the team will guide them.
- Pricing — use only what is written below.
- Demo — ask for name, business type, preferred time.
- Issues — ask user to share details or a screenshot.

Product 1: ${BRAND_NAME}
A video funnel and lead capture platform for creators, entrepreneurs, and business owners.
It helps users share focused video presentations with prospects and capture leads.
Includes: video funnels, landing pages, forms, lead capture, multi-step funnels, recorded-live sessions.
Link: ${NEVORAI_APP_LINK}

Product 2: ${BRAND_NAME} Call
Helps users upload leads, call them directly, tag leads, track follow-ups, see calling data, manage team data, and use an AI assistant to understand lead data.
Link: ${NEVORAI_CALL_LINK}

Pricing:
Basic: ${NEVORAI_BASIC_PRICE}
Pro: ${NEVORAI_PRO_PRICE}
Trial: ${NEVORAI_TRIAL_TEXT}

Support:
Email: ${SUPPORT_EMAIL}
WhatsApp team: ${SUPPORT_WHATSAPP}

Recent conversation so far:
${historyBlock}

Now reply to the latest user message:
User: ${userMessage}
Assistant:`;
}

interface GeminiResult {
  reply: string;
  model: string | null;
  fallback: boolean;
}

async function askGemini(
  userMessage: string,
  ctx: UserContext,
  history: ChatTurn[],
): Promise<GeminiResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return {
      reply: `Thanks for your message. The ${BRAND_NAME} team will get back to you shortly.`,
      model: null,
      fallback: true,
    };
  }

  const prompt = buildGeminiPrompt(userMessage, ctx, history);
  const models = ["gemini-2.5-flash-lite", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      const result = await response.json();
      console.log(`Gemini response from ${model}:`, JSON.stringify(result).slice(0, 400));

      if (!result.error) {
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { reply: text.trim(), model, fallback: false };
      }

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

// ─── WhatsApp send ───────────────────────────────────────────────
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

// ─── Main handler ────────────────────────────────────────────────
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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const respond = () => new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });

  try {
    const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== "text") return respond();

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

    // Lookup user + history in parallel
    const [userCtx, history, settings] = await Promise.all([
      lookupUserByPhone(supabase, from),
      getRecentHistory(supabase, from, CONVERSATION_HISTORY_LIMIT),
      loadSettings(supabase),
    ]);

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

    // Decide reply: rule-based first, Gemini fallback
    const ruleReply = getRuleBasedReply(userText, userCtx);
    let replyText: string;
    let replyMethod: "rule_based" | "ai";
    let aiModel: string | null = null;

    if (ruleReply) {
      replyText = ruleReply;
      replyMethod = "rule_based";
    } else {
      const ai = await askGemini(userText, userCtx, history);
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
