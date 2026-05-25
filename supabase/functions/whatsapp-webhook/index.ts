// Meta WhatsApp Cloud API webhook for Nevorai. (deploy v12 — Academy intent + help article editor bug fix)
//   GET  → token verification handshake
//   POST → inbound message → user lookup → verification check → personalized reply or Gemini AI → send → log
//
// Phase 2 features (on top of Phase 1):
//   - Email-based verification gate (user proves identity by sending registered email)
//   - Persistent 30-day verification in whatsapp_verifications table
//   - Personalized replies for verified users: real plan, real view counts, real expiry dates
//   - Sensitive intents (my plan, my views, renew, upgrade) require verification first
//   - Auto-detects email in messages and verifies if it matches the phone's registered user
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
interface SubscriptionInfo {
  planKey: string;
  tier: string;
  status: string;
  expiresAt: string | null;
  billingType: string | null;
}

interface ViewsInfo {
  daily_used?: number;
  daily_limit?: number;
  monthly_used?: number;
  monthly_limit?: number;
  view_limit_mode?: string;
  [key: string]: unknown;
}

interface UserContext {
  isKnown: boolean;
  isVerified: boolean;
  userId: string | null;
  name: string | null;
  email: string | null;
  plan: string | null;
  subscription: SubscriptionInfo | null;
  views: ViewsInfo | null;
}

async function lookupUserByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<UserContext> {
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
    return {
      isKnown: false, isVerified: false, userId: null, name: null,
      email: null, plan: null, subscription: null, views: null,
    };
  }

  return {
    isKnown: true,
    isVerified: false, // set later by checkVerification
    userId: data.id,
    name: data.full_name,
    email: data.email,
    plan: data.subscription_status || "free",
    subscription: null,
    views: null,
  };
}

// ─── Phase 2: verification + data fetch ──────────────────────────
async function checkVerification(
  supabase: SupabaseClient,
  phone: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_verifications")
    .select("expires_at")
    .eq("phone_number", phone)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

async function recordVerification(
  supabase: SupabaseClient,
  phone: string,
  userId: string,
): Promise<void> {
  await supabase.from("whatsapp_verifications").upsert(
    {
      phone_number: phone,
      user_id: userId,
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_message_at: new Date().toISOString(),
    },
    { onConflict: "phone_number" },
  );
}

async function fetchSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionInfo | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plan_key, tier, status, expires_at, billing_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    planKey: data.plan_key,
    tier: data.tier,
    status: data.status,
    expiresAt: data.expires_at,
    billingType: data.billing_type,
  };
}

async function fetchViews(
  supabase: SupabaseClient,
  userId: string,
): Promise<ViewsInfo | null> {
  const { data, error } = await supabase.rpc("get_user_monthly_views", {
    _user_id: userId,
  });
  if (error || !data) return null;
  return data as ViewsInfo;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_REGEX);
  return m ? m[0].toLowerCase() : null;
}

// ─── Phase 3: lead capture helpers ───────────────────────────────
interface Lead {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  business_type: string | null;
  interest: string | null;
  status: string;
  score: string;
  message_count: number;
  asked_name_at: string | null;
  asked_business_at: string | null;
  asked_interest_at: string | null;
  admin_notified_at: string | null;
}

async function ensureLead(supabase: SupabaseClient, phone: string): Promise<Lead | null> {
  const { data: existing } = await supabase
    .from("whatsapp_leads")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();

  if (existing) return existing as Lead;

  const { data: created } = await supabase
    .from("whatsapp_leads")
    .insert({ phone_number: phone, status: "new", score: "cold", source: "whatsapp" })
    .select("*")
    .single();
  return (created || null) as Lead | null;
}

function extractName(text: string): string | null {
  // Common patterns: "my name is X", "i am X", "i'm X", "this is X", or just "X"
  const patterns = [
    /(?:my name is|i am|i'm|this is|name is|naam hai|main hu|main hoon)\s+([a-zA-Z][a-zA-Z\s.'-]{1,40}?)(?:[.,!?]|$)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/, // Just a name like "Rahul Sharma"
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const cleaned = m[1].trim().replace(/\s+/g, " ");
      // Reject super short / numeric / containing typical non-name words
      if (cleaned.length < 2 || cleaned.length > 50) continue;
      if (/^(yes|no|ok|hi|hello|maybe|sure|thanks|nahi|haan)$/i.test(cleaned)) continue;
      return cleaned;
    }
  }
  return null;
}

function extractBusinessType(text: string): string | null {
  const t = text.toLowerCase();
  // Common business patterns
  const businessKeywords = [
    "coach", "coaching", "consultant", "agency", "freelancer", "creator",
    "agent", "insurance agent", "real estate", "realtor", "doctor", "dentist",
    "teacher", "trainer", "tutor", "lawyer", "ca", "chartered accountant",
    "yoga", "fitness", "gym", "nutritionist", "dietician",
    "restaurant", "cafe", "shop", "store", "retail", "ecommerce", "e-commerce",
    "salon", "spa", "beauty", "makeup artist",
    "photographer", "videographer", "designer", "developer",
    "mlm", "network marketing", "direct selling", "distributor", "flp",
    "marketing", "sales", "saas", "startup", "business",
  ];
  for (const kw of businessKeywords) {
    if (new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(t)) {
      return kw;
    }
  }
  // Pattern: "I am a/an X" or "I run a X" or "I do X" or "my business is X"
  const m = t.match(/(?:i am (?:a|an)|i run (?:a|an)?|i do|my business is|i have (?:a|an)|i sell)\s+([a-z][a-z\s-]{2,40}?)(?:[.,!?]|$)/i);
  if (m && m[1]) {
    return m[1].trim().slice(0, 60);
  }
  return null;
}

function extractInterest(text: string): "nevorai" | "nevorai_call" | "both" | null {
  const t = text.toLowerCase();
  const wantsCall = /\b(nevorai call|nevoraicall|calling|crm|follow.?up|lead tracking|call app)\b/i.test(t);
  const wantsApp = /\b(video funnel|funnel|landing page|nevorai app|lead capture|video platform)\b/i.test(t);
  if (wantsCall && wantsApp) return "both";
  if (wantsCall) return "nevorai_call";
  if (wantsApp) return "nevorai";
  return null;
}

function computeLeadScore(lead: Lead): "hot" | "warm" | "cold" {
  let pts = 0;
  if (lead.name) pts += 1;
  if (lead.email) pts += 2;
  if (lead.business_type) pts += 1;
  if (lead.interest) pts += 2;
  if (lead.message_count >= 5) pts += 1;
  if (lead.message_count >= 10) pts += 1;
  // Status signals
  if (lead.status === "demo_booked") pts += 3;
  if (lead.status === "qualified") pts += 2;
  if (pts >= 6) return "hot";
  if (pts >= 3) return "warm";
  return "cold";
}

interface LeadUpdateResult {
  lead: Lead;
  addToReply: string | null; // Optional natural prompt to append to bot reply
  becameHot: boolean;
}

async function updateLeadFromMessage(
  supabase: SupabaseClient,
  lead: Lead,
  userText: string,
): Promise<LeadUpdateResult> {
  const updates: Partial<Lead> & Record<string, unknown> = {
    message_count: lead.message_count + 1,
    last_message_at: new Date().toISOString(),
  };

  // Extract info from message
  if (!lead.name) {
    const n = extractName(userText);
    if (n) updates.name = n;
  }
  if (!lead.email) {
    const e = extractEmail(userText);
    if (e) updates.email = e;
  }
  if (!lead.business_type) {
    const b = extractBusinessType(userText);
    if (b) updates.business_type = b;
  }
  if (!lead.interest) {
    const i = extractInterest(userText);
    if (i) updates.interest = i;
  }

  const newMessageCount = lead.message_count + 1;
  if (lead.status === "new" && newMessageCount >= 3) updates.status = "engaged";

  // Apply updates first to get fresh values
  const merged: Lead = { ...lead, ...updates } as Lead;
  const newScore = computeLeadScore(merged);
  if (newScore !== lead.score) updates.score = newScore;

  // Qualification: has at least name + (business or interest)
  const willHaveName = merged.name || updates.name;
  const willHaveBusiness = merged.business_type || updates.business_type;
  const willHaveInterest = merged.interest || updates.interest;
  if (
    (lead.status === "new" || lead.status === "engaged") &&
    willHaveName &&
    (willHaveBusiness || willHaveInterest)
  ) {
    updates.status = "qualified";
  }

  // Decide if bot should add a natural prompt to its reply
  let addToReply: string | null = null;
  const justGotName = !lead.name && updates.name;
  const justGotBusiness = !lead.business_type && updates.business_type;
  const newCountForAsks = newMessageCount;

  if (
    !merged.name &&
    !updates.name &&
    newCountForAsks >= 2 &&
    !lead.asked_name_at
  ) {
    addToReply = `By the way, what's your name? I'd love to address you properly.`;
    updates.asked_name_at = new Date().toISOString();
  } else if (
    (merged.name || updates.name) &&
    !merged.business_type &&
    !updates.business_type &&
    newCountForAsks >= 3 &&
    !lead.asked_business_at
  ) {
    const firstName = (updates.name || merged.name || "").toString().split(" ")[0];
    addToReply = `Also${firstName ? `, ${firstName}` : ""}, what kind of business do you run? That helps me suggest the right tools.`;
    updates.asked_business_at = new Date().toISOString();
  } else if (
    (merged.name || updates.name) &&
    (merged.business_type || updates.business_type) &&
    !merged.interest &&
    !updates.interest &&
    newCountForAsks >= 4 &&
    !lead.asked_interest_at
  ) {
    addToReply = `Quick question — what interests you more: video funnels (Nevorai) or lead calling/follow-up (Nevorai Call)? Or both?`;
    updates.asked_interest_at = new Date().toISOString();
  }

  const { data: updated } = await supabase
    .from("whatsapp_leads")
    .update(updates)
    .eq("id", lead.id)
    .select("*")
    .single();

  const finalLead = (updated || merged) as Lead;
  const becameHot = lead.score !== "hot" && finalLead.score === "hot";

  // Acknowledge captured info naturally
  if (justGotName && !addToReply) {
    const fn = (updates.name || "").toString().split(" ")[0];
    addToReply = `Nice to meet you, ${fn}!`;
  }
  if (justGotBusiness && !addToReply) {
    addToReply = `Got it — noted your business type.`;
  }

  return { lead: finalLead, addToReply, becameHot };
}

async function notifyAdminOfHotLead(
  supabase: SupabaseClient,
  settings: WhatsAppSettings,
  lead: Lead,
): Promise<void> {
  // Find admin phone — for now, hardcode socialwiire's known phone OR look up first admin profile
  const { data: adminProfile } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  let adminPhone: string | null = null;
  if (adminProfile) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone, whatsapp_number")
      .eq("id", (adminProfile as { user_id: string }).user_id)
      .maybeSingle();
    if (prof) {
      adminPhone = (prof as { phone: string | null; whatsapp_number: string | null }).phone
        || (prof as { phone: string | null; whatsapp_number: string | null }).whatsapp_number;
    }
  }

  if (!adminPhone) return; // No admin phone configured — skip silently

  const message = `🔥 NEW HOT LEAD on Nevorai WhatsApp

Phone: +${lead.phone_number}
Name: ${lead.name || "(not yet)"}
Business: ${lead.business_type || "(not yet)"}
Interest: ${lead.interest || "(not yet)"}
Email: ${lead.email || "(not yet)"}
Messages: ${lead.message_count}

View in admin: ${NEVORAI_APP_LINK}/admin/whatsapp`;

  if (settings.phone_number_id && settings.access_token) {
    await sendWhatsAppText(
      settings.phone_number_id,
      settings.access_token,
      adminPhone.replace(/\D/g, ""),
      message,
    );
    await supabase
      .from("whatsapp_leads")
      .update({ admin_notified_at: new Date().toISOString() })
      .eq("id", lead.id);
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "unknown";
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPlanDisplay(sub: SubscriptionInfo | null, fallbackPlan: string | null): string {
  if (sub && sub.planKey) return cap(sub.planKey);
  return cap(fallbackPlan || "free");
}

// ─── Intent system ───────────────────────────────────────────────
function normalizeText(message: string): string {
  return message.toLowerCase().trim();
}

// Word-boundary safe matcher. "hi" won't match "this"; "compare plans" still matches in longer text.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => {
    const pattern = new RegExp(`\\b${escapeRegex(k)}\\b`, "i");
    return pattern.test(text);
  });
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

  // ── Account info (MUST come before Pricing — "my plan" contains "plan") ─
  {
    match: (t) => includesAny(t, ["my account", "my plan", "my subscription", "account info", "account status", "account details"]),
    reply: (ctx) => ctx.isKnown
      ? `Hi ${ctx.name?.split(" ")[0] || "there"}, please reply with your registered email so I can confirm it's you, then I'll share your account details.`
      : `It looks like you're not signed up yet. Create your account at ${NEVORAI_APP_LINK}/auth to get started.`,
  },

  // ── My views (MUST come before Views/limits and Pricing) ─────
  {
    match: (t) => includesAny(t, ["my views", "views left", "views remaining", "my view limit", "views today", "views used"]),
    reply: (ctx) => ctx.isKnown
      ? `Hi ${ctx.name?.split(" ")[0] || "there"}, please reply with your registered email so I can confirm it's you, then I'll share your view stats.`
      : `${BRAND_NAME} has tiered view limits depending on your plan. Visit ${NEVORAI_APP_LINK}/pricing for details.`,
  },

  // ── My audience / who is this for ─────────────────────────────
  {
    match: (t) => includesAny(t, ["for whom", "for whome", "who is this for", "who is it for", "target audience", "who uses nevorai", "who is nevorai for"]),
    reply: () => `${BRAND_NAME} is built for:

• Creators sharing video content with prospects
• Entrepreneurs running video sales funnels
• Business owners doing lead capture & follow-up
• Sales teams managing leads and calls

Are you one of these? Tell me more about your business and I'll show how ${BRAND_NAME} can help.`,
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

  // ── View limits (general, non-personal) ───────────────────────
  {
    match: (t) => includesAny(t, ["view limit", "daily views", "monthly views", "how many views", "view tiers"]),
    reply: () => `${BRAND_NAME} has tiered view limits depending on your plan. See full tiers at ${NEVORAI_APP_LINK}/pricing. Need a top-up? Visit ${NEVORAI_APP_LINK}/billing.`,
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

  // ── Academy / tutorials ───────────────────────────────────────
  {
    match: (t) => includesAny(t, ["academy", "academy link", "tutorials link", "all tutorials", "learn nevorai", "nevorai academy", "training videos", "knowledge base"]),
    reply: () => `📚 Visit Nevorai Academy for all our tutorials in one place:

${NEVORAI_APP_LINK}/academy

You'll find step-by-step guides on funnels, lead capture, billing, and more. Want me to send a specific tutorial? Just ask "how to upload video" or any feature you're stuck on.`,
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

// ─── Phase 2: sensitive intents (need verified user) ─────────────
// Returns a reply string if the message matches a sensitive intent.
// If the user is known but not verified, returns the "ask for email" prompt.
// If the user is not known at all, returns null (let normal flow handle).
type SensitiveIntent =
  | "my_plan"
  | "my_views"
  | "renew"
  | "upgrade"
  | "my_account"
  | "my_invoice";

function detectSensitiveIntent(text: string): SensitiveIntent | null {
  const t = normalizeText(text);
  if (/(my plan|my subscription|what.?s my plan|which plan am i|current plan)/i.test(t)) return "my_plan";
  if (/(my views|views left|view limit|how many views.*(left|remaining|used))/i.test(t)) return "my_views";
  if (/(renew (my|now|plan)|renew now|extend my plan|renew subscription)/i.test(t)) return "renew";
  if (/(upgrade me|upgrade now|upgrade my plan|move me to pro|go pro)/i.test(t)) return "upgrade";
  if (/(my account|account details|account status|account info)/i.test(t)) return "my_account";
  if (/(my invoice|latest invoice|my receipt|my bill)/i.test(t)) return "my_invoice";
  return null;
}

function askForEmail(ctx: UserContext): string {
  const firstName = ctx.name?.split(" ")[0] || "there";
  return `Hi ${firstName}! Before I share your account details, please reply with the email you used to sign up so I can confirm it's you.`;
}

function buildPersonalizedReply(intent: SensitiveIntent, ctx: UserContext): string {
  const firstName = ctx.name?.split(" ")[0] || "there";
  const planName = formatPlanDisplay(ctx.subscription, ctx.plan);
  const expiry = formatDate(ctx.subscription?.expiresAt || null);

  switch (intent) {
    case "my_plan":
    case "my_account": {
      const lines = [
        `Hi ${firstName}, here's your account:`,
        ``,
        `Plan: ${planName}`,
      ];
      if (ctx.subscription?.tier) lines.push(`Tier: ${ctx.subscription.tier}`);
      if (ctx.subscription?.status) lines.push(`Status: ${cap(ctx.subscription.status)}`);
      if (ctx.subscription?.expiresAt) lines.push(`Expires: ${expiry}`);
      lines.push(``, `Manage at ${NEVORAI_APP_LINK}/billing`);
      return lines.join("\n");
    }

    case "my_views": {
      if (!ctx.views) {
        return `I couldn't fetch your view stats right now. Please check ${NEVORAI_APP_LINK}/dashboard for live numbers.`;
      }
      const dailyUsed = ctx.views.daily_used ?? 0;
      const dailyLimit = ctx.views.daily_limit ?? "—";
      const monthlyUsed = ctx.views.monthly_used ?? 0;
      const monthlyLimit = ctx.views.monthly_limit ?? "—";
      return `Hi ${firstName}, your views:

Today: ${dailyUsed} / ${dailyLimit === -1 ? "unlimited" : dailyLimit}
This month: ${monthlyUsed} / ${monthlyLimit === -1 ? "unlimited" : monthlyLimit}

Need more views? Top up at ${NEVORAI_APP_LINK}/billing`;
    }

    case "renew": {
      return `Renew your ${planName} plan here: ${NEVORAI_APP_LINK}/billing

Your plan ${ctx.subscription?.expiresAt ? `expires on ${expiry}` : "is on auto-renew"}. Need help? Just reply here.`;
    }

    case "upgrade": {
      return `You can upgrade anytime at ${NEVORAI_APP_LINK}/upgrade.

We use fair prorated pricing — you only pay the difference for the days remaining in your current cycle.`;
    }

    case "my_invoice": {
      return `Your invoices are at ${NEVORAI_APP_LINK}/billing.

Need a GST/tax invoice? Just reply with your company name and GSTIN and our team will email it.`;
    }
  }
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
  let userBlock: string;
  if (ctx.isKnown && ctx.isVerified) {
    userBlock = `You are speaking with an existing, VERIFIED ${BRAND_NAME} user. Be warm and helpful.
User name: ${ctx.name || "Unknown"}
You may reference their account context if useful.
Avoid pitching from scratch. Focus on helping them with their question.`;
  } else if (ctx.isKnown && !ctx.isVerified) {
    userBlock = `You are speaking with someone whose phone number matches a ${BRAND_NAME} account, but they have NOT verified their identity yet.
User first name (safe to greet by): ${ctx.name?.split(" ")[0] || "there"}

CRITICAL PRIVACY RULES:
- DO NOT mention or confirm anything about their plan, billing, trial, views, subscription, expiry, payment, or any account-specific details.
- DO NOT say things like "you're on free trial" or "your plan is X".
- If they ask about their account/plan/views/billing: tell them to reply with the email they used to sign up so the bot can verify them first.
- General product questions (pricing, features, demo, support) are fine to answer.`;
  } else {
    userBlock = `You are speaking with someone who is NOT yet a ${BRAND_NAME} user (a prospect). Be welcoming, explain things simply, and guide them toward signing up if relevant. Do not assume they know ${BRAND_NAME} already.`;
  }

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

// ─── Phase 4: media + interactive buttons ────────────────────────
interface MediaRecord {
  key: string;
  type: "video" | "image" | "document" | "audio";
  url: string;
  caption: string | null;
  filename: string | null;
}

async function fetchMedia(supabase: SupabaseClient, key: string): Promise<MediaRecord | null> {
  const { data } = await supabase
    .from("whatsapp_media")
    .select("key, type, url, caption, filename")
    .eq("key", key)
    .eq("is_active", true)
    .maybeSingle();
  return (data as MediaRecord | null) || null;
}

async function sendWhatsAppMedia(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  media: MediaRecord,
): Promise<{ ok: boolean; metaMessageId: string | null; error: string | null }> {
  try {
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: media.type,
    };

    if (media.type === "video") {
      payload.video = { link: media.url, caption: media.caption || undefined };
    } else if (media.type === "image") {
      payload.image = { link: media.url, caption: media.caption || undefined };
    } else if (media.type === "document") {
      payload.document = {
        link: media.url,
        filename: media.filename || "document.pdf",
        caption: media.caption || undefined,
      };
    } else if (media.type === "audio") {
      payload.audio = { link: media.url };
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

interface ButtonReply {
  id: string;     // e.g. "book_demo"
  title: string;  // max 20 chars displayed
}

async function sendWhatsAppButtons(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: ButtonReply[],
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
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: bodyText.slice(0, 1024) },
            action: {
              buttons: buttons.slice(0, 3).map((b) => ({
                type: "reply",
                reply: { id: b.id, title: b.title.slice(0, 20) },
              })),
            },
          },
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

// Detect intents that should send rich media instead of text
type MediaIntent = string; // any key in whatsapp_media

function detectMediaIntent(text: string): MediaIntent | null {
  const t = normalizeText(text);
  if (/(send (me )?(a |the )?demo|show (me )?(a |the )?demo|demo video|video demo|watch demo|see demo)/i.test(t)) {
    return "demo_video";
  }
  if (/(brochure|pdf|product details|details document|send (me )?(the )?(catalog|catalogue))/i.test(t)) {
    return "brochure";
  }
  // Common "how to" intents — map to media keys (admin can configure which video each plays)
  if (/(how (do i |to )?upload (a )?video|upload video|video upload)/i.test(t)) return "upload_help";
  if (/(how (do i |to )?(create|make|build) (a )?funnel|funnel builder|funnel guide)/i.test(t)) return "create_funnel";
  if (/(how (do i |to )?(skip|end)( the)? (end|endout|step)|skip endout|end out)/i.test(t)) return "skip_endout";
  if (/(how (do i |to )?(set up|configure|build) lead capture|lead capture (help|setup|guide))/i.test(t)) return "lead_capture_help";
  if (/(how (do i |to )?(create|build|make) (a )?landing page|landing page (help|guide))/i.test(t)) return "landing_page_help";
  if (/(billing help|how (do i |to )?pay|payment help|how billing works)/i.test(t)) return "billing_help";
  if (/(connect whatsapp|whatsapp setup|whatsapp automation setup|set up whatsapp)/i.test(t)) return "whatsapp_setup_help";
  return null;
}

// ─── Knowledge Base: search help articles by keywords ────────────
interface HelpArticleHit {
  title: string;
  content: string;
  media_key: string | null;
  academy_tutorial_id: string | null;
}

async function searchHelpArticle(
  supabase: SupabaseClient,
  userText: string,
): Promise<HelpArticleHit | null> {
  const t = normalizeText(userText);
  // Extract tokens for keyword overlap
  const tokens = t
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !["please", "could", "would", "should", "where", "what", "how", "about", "this", "that", "with", "from", "have", "the", "and", "for", "you"].includes(w));
  if (tokens.length === 0) return null;

  // Get all published articles (small table — fine to scan in memory)
  const { data: articles } = await supabase
    .from("whatsapp_help_articles")
    .select("title, content, keywords, media_key, academy_tutorial_id")
    .eq("is_published", true);

  if (!articles || articles.length === 0) return null;

  // Score by keyword overlap (count of matching keywords + bonus for exact phrase)
  let bestScore = 0;
  let bestArticle: HelpArticleHit | null = null;
  for (const a of articles as Array<{
    title: string;
    content: string;
    keywords: string[];
    media_key: string | null;
    academy_tutorial_id: string | null;
  }>) {
    let score = 0;
    const lowerKeywords = (a.keywords || []).map((k) => k.toLowerCase());
    for (const tok of tokens) {
      for (const kw of lowerKeywords) {
        if (kw === tok) score += 3;
        else if (kw.includes(tok) || tok.includes(kw)) score += 1;
      }
    }
    // Bonus: title token match
    const titleLower = a.title.toLowerCase();
    for (const tok of tokens) {
      if (titleLower.includes(tok)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestArticle = {
        title: a.title,
        content: a.content,
        media_key: a.media_key,
        academy_tutorial_id: a.academy_tutorial_id,
      };
    }
  }

  // Require at least 4 points to consider it a real match
  return bestScore >= 4 ? bestArticle : null;
}

async function fetchAcademyTutorialAsMedia(
  supabase: SupabaseClient,
  tutorialId: string,
): Promise<MediaRecord | null> {
  const { data } = await supabase
    .from("academy_tutorials")
    .select("title, description, video_url")
    .eq("id", tutorialId)
    .maybeSingle();
  if (!data) return null;
  const t = data as { title: string; description: string | null; video_url: string };
  return {
    key: `academy_${tutorialId.slice(0, 8)}`,
    type: "video",
    url: t.video_url,
    caption: t.description?.slice(0, 200) || t.title,
    filename: null,
  };
}

// Search Nevorai Academy for tutorials matching the question.
// Returns the best matching tutorial as a temporary media record (not stored in whatsapp_media).
async function searchAcademyByTopic(
  supabase: SupabaseClient,
  userText: string,
): Promise<MediaRecord | null> {
  const t = normalizeText(userText);
  // Extract significant tokens
  const tokens = t
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .filter((w) => !["please", "could", "would", "should", "where", "what", "how", "about", "this", "that", "with", "from", "have"].includes(w))
    .slice(0, 5);
  if (tokens.length === 0) return null;

  const orFilters = tokens
    .map((tok) => `title.ilike.%${tok}%,description.ilike.%${tok}%`)
    .join(",");

  const { data } = await supabase
    .from("academy_tutorials")
    .select("title, description, video_url, thumbnail_url, category")
    .eq("is_published", true)
    .or(orFilters)
    .limit(1);

  const tutorial = (data || [])[0] as { title: string; description: string; video_url: string } | undefined;
  if (!tutorial) return null;

  return {
    key: "academy_search",
    type: "video",
    url: tutorial.video_url,
    caption: `📚 Found this in our Academy: ${tutorial.title}\n\n${(tutorial.description || "").slice(0, 200)}`,
    filename: null,
  };
}

// Detect intents that benefit from interactive buttons
function shouldUseButtons(text: string, isKnown: boolean): { use: boolean; body: string; buttons: ButtonReply[] } | null {
  const t = normalizeText(text);

  // Greeting from unknown user → offer buttons
  if (!isKnown && /\b(hi|hello|hii|hey|namaste|hola|good morning|good evening|good afternoon)\b/i.test(t) && t.length < 25) {
    return {
      use: true,
      body: `Hi! Welcome to ${BRAND_NAME}. What would you like to do?`,
      buttons: [
        { id: "see_pricing", title: "See pricing" },
        { id: "watch_demo", title: "Watch demo" },
        { id: "book_demo", title: "Book a demo" },
      ],
    };
  }

  return null;
}

// Map interactive button replies to user-readable text so existing intent system handles them
function buttonReplyToText(buttonId: string): string {
  const map: Record<string, string> = {
    see_pricing: "pricing",
    watch_demo: "send me a demo video",
    book_demo: "book demo",
    talk_human: "talk to human",
    upgrade: "upgrade me",
    renew: "renew my plan",
  };
  return map[buttonId] || buttonId;
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
    if (!message) return respond();

    const from: string = message.from;
    const inboundMetaId: string | null = message.id || null;

    // Phase 4: handle button clicks by mapping their id to a text query
    let userText: string;
    if (message.type === "text") {
      userText = message.text?.body || "";
    } else if (message.type === "interactive" && message.interactive?.type === "button_reply") {
      const btnId: string = message.interactive.button_reply.id;
      userText = buttonReplyToText(btnId);
      console.log(`Button click: ${btnId} → mapped to "${userText}"`);
    } else {
      // Unsupported message type (sticker, location, etc.) — just log inbound and skip
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        direction: "inbound",
        message_body: `[${message.type}]`,
        message_type: message.type,
        meta_message_id: inboundMetaId,
        status: "received",
        raw_payload: payload,
      });
      return respond();
    }

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

    // Lookup user + history + settings + verification in parallel
    const [userCtxBase, history, settings, isVerified] = await Promise.all([
      lookupUserByPhone(supabase, from),
      getRecentHistory(supabase, from, CONVERSATION_HISTORY_LIMIT),
      loadSettings(supabase),
      checkVerification(supabase, from),
    ]);

    const userCtx: UserContext = { ...userCtxBase, isVerified };

    // Phase 3: if unknown phone, track as lead
    let leadUpdate: LeadUpdateResult | null = null;
    if (!userCtx.isKnown) {
      const lead = await ensureLead(supabase, from);
      if (lead) {
        leadUpdate = await updateLeadFromMessage(supabase, lead, userText);
      }
    }

    // Phase 5: check if bot is paused for this phone (admin took over)
    const { data: pause } = await supabase
      .from("whatsapp_bot_pauses")
      .select("phone_number")
      .eq("phone_number", from)
      .maybeSingle();

    if (pause) {
      console.log(`Bot paused for ${from} — skipping auto-reply`);
      await supabase.from("whatsapp_conversations").insert({
        phone_number: from,
        direction: "outbound",
        message_body: null,
        status: "skipped",
        reply_method: "none",
        error_message: "Bot paused for this phone (admin taking over)",
      });
      return respond();
    }

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

    // Phase 2: Detect email in message — if matches known user's email, mark verified
    let replyText: string;
    let replyMethod: "rule_based" | "ai" | "verification" | "personalized";
    let aiModel: string | null = null;

    const possibleEmail = extractEmail(userText);
    if (
      userCtx.isKnown &&
      !userCtx.isVerified &&
      possibleEmail &&
      userCtx.email &&
      possibleEmail === userCtx.email.toLowerCase()
    ) {
      // Verify them
      await recordVerification(supabase, from, userCtx.userId!);
      userCtx.isVerified = true;
      const firstName = userCtx.name?.split(" ")[0] || "there";
      replyText = `Verified ✓ Thanks ${firstName}! You can now ask me about your plan, views, renewal, or upgrade. What would you like to know?`;
      replyMethod = "verification";
    } else {
      // Sensitive intents need verification
      const sensitive = userCtx.isKnown ? detectSensitiveIntent(userText) : null;

      if (sensitive && !userCtx.isVerified) {
        replyText = askForEmail(userCtx);
        replyMethod = "verification";
      } else if (sensitive && userCtx.isVerified && userCtx.userId) {
        // Fetch fresh subscription + views data
        const [subscription, views] = await Promise.all([
          fetchSubscription(supabase, userCtx.userId),
          fetchViews(supabase, userCtx.userId),
        ]);
        userCtx.subscription = subscription;
        userCtx.views = views;
        replyText = buildPersonalizedReply(sensitive, userCtx);
        replyMethod = "personalized";
      } else {
        // Normal flow: rule-based → help articles → Gemini fallback
        const ruleReply = getRuleBasedReply(userText, userCtx);
        if (ruleReply) {
          replyText = ruleReply;
          replyMethod = "rule_based";
        } else {
          // Knowledge base lookup
          const article = await searchHelpArticle(supabase, userText);
          if (article) {
            replyText = `${article.title}\n\n${article.content}`;
            replyMethod = "rule_based"; // structured step-by-step counts as rule-based
            // If article has a linked academy tutorial, queue it as media to send alongside
            if (article.academy_tutorial_id) {
              const academyMedia = await fetchAcademyTutorialAsMedia(supabase, article.academy_tutorial_id);
              if (academyMedia && settings.phone_number_id && settings.access_token) {
                await sendWhatsAppMedia(
                  settings.phone_number_id,
                  settings.access_token,
                  from,
                  academyMedia,
                );
              }
            } else if (article.media_key) {
              const m = await fetchMedia(supabase, article.media_key);
              if (m && settings.phone_number_id && settings.access_token) {
                await sendWhatsAppMedia(
                  settings.phone_number_id,
                  settings.access_token,
                  from,
                  m,
                );
              }
            }
          } else {
            const ai = await askGemini(userText, userCtx, history);
            replyText = ai.reply;
            replyMethod = "ai";
            aiModel = ai.model;
          }
        }
      }
    }

    // Phase 4: detect media intent — if matched, send media (and skip text reply if successful)
    let mediaSendResult: { ok: boolean; metaMessageId: string | null; error: string | null } | null = null;
    let mediaSentKey: string | null = null;
    const mediaIntent = detectMediaIntent(userText);
    if (mediaIntent && settings.phone_number_id && settings.access_token) {
      const media = await fetchMedia(supabase, mediaIntent);
      if (media) {
        mediaSendResult = await sendWhatsAppMedia(
          settings.phone_number_id,
          settings.access_token,
          from,
          media,
        );
        mediaSentKey = mediaIntent;
        if (mediaSendResult.ok) {
          replyText = mediaIntent === "demo_video"
            ? `Sent the demo video above 👆 Have a look and let me know what you think!`
            : mediaIntent === "brochure"
            ? `Sent the document above 👆 Let me know if you have questions!`
            : `Here's a tutorial that should help 👆 Let me know if anything is unclear.`;
        }
      } else {
        // No mapped media for this intent — fall back to academy search
        const academyMedia = await searchAcademyByTopic(supabase, userText);
        if (academyMedia && settings.phone_number_id && settings.access_token) {
          mediaSendResult = await sendWhatsAppMedia(
            settings.phone_number_id,
            settings.access_token,
            from,
            academyMedia,
          );
          mediaSentKey = "academy_search";
          if (mediaSendResult.ok) {
            replyText = `Found a relevant tutorial in our Academy 👆 Let me know if this answers your question.`;
          }
        }
      }
    } else if (replyMethod === "ai") {
      // Even when intent didn't match a media key, if Gemini got triggered, try academy
      const academyMedia = await searchAcademyByTopic(supabase, userText);
      if (academyMedia && settings.phone_number_id && settings.access_token) {
        mediaSendResult = await sendWhatsAppMedia(
          settings.phone_number_id,
          settings.access_token,
          from,
          academyMedia,
        );
        mediaSentKey = "academy_search";
        if (mediaSendResult.ok) {
          // Keep the Gemini reply but append a hint about the academy video
          replyText = `${replyText}\n\nP.S. I also sent a related tutorial from our Academy above 👆`;
        }
      }
    }

    // Phase 4: detect button-suitable intent (offer interactive buttons instead of plain text)
    const buttonPlan = !mediaIntent ? shouldUseButtons(userText, userCtx.isKnown) : null;
    let buttonSendResult: { ok: boolean; metaMessageId: string | null; error: string | null } | null = null;
    if (buttonPlan && settings.phone_number_id && settings.access_token) {
      buttonSendResult = await sendWhatsAppButtons(
        settings.phone_number_id,
        settings.access_token,
        from,
        buttonPlan.body,
        buttonPlan.buttons,
      );
      if (buttonSendResult.ok) {
        replyText = buttonPlan.body;
      }
    }

    // Phase 3: append natural lead-capture prompt if relevant
    if (leadUpdate && leadUpdate.addToReply) {
      replyText = `${replyText}\n\n${leadUpdate.addToReply}`;
    }

    // If media or buttons already delivered the primary content, don't double-send a text reply
    const skipTextSend =
      (mediaSendResult?.ok === true && (!leadUpdate || !leadUpdate.addToReply)) ||
      (buttonSendResult?.ok === true);

    const sendResult = skipTextSend
      ? mediaSendResult || buttonSendResult || { ok: true, metaMessageId: null, error: null }
      : await sendWhatsAppText(
          settings.phone_number_id,
          settings.access_token,
          from,
          replyText,
        );

    // Phase 3: notify admin if lead became hot (fire-and-forget)
    if (leadUpdate && leadUpdate.becameHot && !leadUpdate.lead.admin_notified_at) {
      notifyAdminOfHotLead(supabase, settings, leadUpdate.lead).catch((e) =>
        console.error("Failed to notify admin of hot lead:", (e as Error).message),
      );
    }

    const outboundType = mediaSendResult?.ok
      ? (mediaSentKey === "brochure" ? "document" : "video")
      : buttonSendResult?.ok
      ? "interactive"
      : "text";

    await supabase.from("whatsapp_conversations").insert({
      phone_number: from,
      direction: "outbound",
      message_body: mediaSendResult?.ok
        ? `[media:${mediaSentKey}] ${replyText}`
        : buttonSendResult?.ok
        ? `[buttons] ${replyText}`
        : replyText,
      message_type: outboundType,
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
