// Nev AI — analytics chat assistant for creators (v1.1.0)
// Hardened: per-query try/catch, auto-detect funnels owner column, debug mode.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_LIMIT_BY_PLAN: Record<string, number> = {
  basic: 20,
  pro: 100,
  trial: 30,
};

interface ChatMsg { role: "user" | "assistant"; content: string }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Cached column name for funnels owner
let FUNNEL_OWNER_COL: "owner_id" | "user_id" | null = null;

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T, errs: string[]): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const msg = `${label}: ${e?.message || String(e)}`;
    console.error("[nev-ai]", msg);
    errs.push(msg);
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { reply: "Method not allowed" });

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const errs: string[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) return json(500, { reply: "Nev AI is not configured yet. Please try again later." });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json(401, { reply: "Please sign in to use Nev AI." });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { reply: "Please sign in to use Nev AI." });
    const user = userData.user;

    const { message, history } = (await req.json().catch(() => ({}))) as {
      message?: string;
      history?: ChatMsg[];
    };
    if (!message || typeof message !== "string" || !message.trim()) {
      return json(400, { reply: "Please type a question first." });
    }
    if (message.length > 1000) {
      return json(400, { reply: "Question is too long. Please keep it under 1000 characters." });
    }

    // ---- Plan gate (defensive) ----
    const sub = await safe("user_subscriptions", async () => {
      const { data, error } = await admin
        .from("user_subscriptions")
        .select("tier, status")
        .eq("user_id", user.id)
        .in("status", ["active", "payment_failed", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { tier?: string; status?: string } | null;
    }, null, errs);

    const profile = await safe("profiles", async () => {
      const { data, error } = await admin
        .from("profiles")
        .select("full_name, trial_start_date, subscription_status, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    }, null, errs);

    let effectivePlan: string = (sub?.tier as string) || "free";
    const trialStart = profile?.trial_start_date ? new Date(profile.trial_start_date) : null;
    const trialActive = trialStart
      ? (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24) <= 7
      : false;
    if (effectivePlan === "free" && trialActive) effectivePlan = "trial";

    if (!DAILY_LIMIT_BY_PLAN[effectivePlan]) {
      return json(403, {
        reply:
          "Nev AI is available on Basic and Pro plans. Upgrade to start asking questions about your analytics.",
        usage: null,
      });
    }
    const dailyLimit = DAILY_LIMIT_BY_PLAN[effectivePlan];

    // ---- Quota ----
    const today = new Date().toISOString().slice(0, 10);
    const usageRow = await safe("nev_ai_usage", async () => {
      const { data, error } = await admin
        .from("nev_ai_usage")
        .select("count")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return data as { count: number } | null;
    }, null, errs);
    const usedSoFar = usageRow?.count ?? 0;

    if (usedSoFar >= dailyLimit) {
      return json(429, {
        reply: `You've reached today's Nev AI question limit (${usedSoFar}/${dailyLimit}). It resets tomorrow.`,
        usage: { used: usedSoFar, limit: dailyLimit },
      });
    }

    // ---- Funnels (auto-detect owner column) ----
    const fetchFunnels = async (col: "owner_id" | "user_id") => {
      const { data, error } = await admin
        .from("funnels")
        .select(`id, title, is_published, total_views, total_leads, total_payments, created_at`)
        .eq(col, user.id)
        .order("total_views", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    };

    let funnels: any[] = [];
    try {
      if (FUNNEL_OWNER_COL) {
        funnels = await fetchFunnels(FUNNEL_OWNER_COL);
      } else {
        try {
          funnels = await fetchFunnels("owner_id");
          FUNNEL_OWNER_COL = "owner_id";
        } catch (e: any) {
          if (String(e?.code) === "42703" || /column .* does not exist/i.test(e?.message || "")) {
            funnels = await fetchFunnels("user_id");
            FUNNEL_OWNER_COL = "user_id";
          } else {
            throw e;
          }
        }
      }
    } catch (e: any) {
      const msg = `funnels: ${e?.message || String(e)} (code=${e?.code})`;
      console.error("[nev-ai]", msg);
      errs.push(msg);
    }

    // ---- Daily views ----
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);

    const dailyViews = await safe("user_daily_views", async () => {
      const { data, error } = await admin
        .from("user_daily_views")
        .select("date, views")
        .eq("user_id", user.id)
        .gte("date", sinceIso)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as Array<{ date: string; views: number }>) || [];
    }, [] as Array<{ date: string; views: number }>, errs);

    // ---- Leads ----
    let leads30: Array<{ funnel_id: string; count: number }> = [];
    let leadsToday = 0;
    let leadsThisWeek = 0;
    if (funnels.length) {
      const funnelIds = funnels.map((f: any) => f.id);
      const leadsRows = await safe("funnel_leads", async () => {
        const { data, error } = await admin
          .from("funnel_leads")
          .select("funnel_id, created_at")
          .in("funnel_id", funnelIds)
          .gte("created_at", since.toISOString());
        if (error) throw error;
        return (data as Array<{ funnel_id: string; created_at: string }>) || [];
      }, [] as Array<{ funnel_id: string; created_at: string }>, errs);

      const byFunnel = new Map<string, number>();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      for (const r of leadsRows) {
        byFunnel.set(r.funnel_id, (byFunnel.get(r.funnel_id) || 0) + 1);
        const d = new Date(r.created_at);
        if (r.created_at.slice(0, 10) === today) leadsToday++;
        if (d >= weekAgo) leadsThisWeek++;
      }
      leads30 = Array.from(byFunnel.entries()).map(([funnel_id, count]) => ({ funnel_id, count }));
    }

    // ---- Aggregates ----
    const todayViews = dailyViews.find((d) => d.date === today)?.views ?? 0;
    const weekAgoDate = new Date(); weekAgoDate.setDate(weekAgoDate.getDate() - 7);
    const weekAgoKey = weekAgoDate.toISOString().slice(0, 10);
    const weekViews = dailyViews
      .filter((d) => d.date >= weekAgoKey)
      .reduce((a, d) => a + (d.views || 0), 0);
    const monthViews = dailyViews.reduce((a, d) => a + (d.views || 0), 0);

    const totalAllViews = funnels.reduce((a: number, f: any) => a + (f.total_views || 0), 0);
    const totalAllLeads = funnels.reduce((a: number, f: any) => a + (f.total_leads || 0), 0);
    const conversionRate =
      totalAllViews > 0 ? Math.round((totalAllLeads / totalAllViews) * 10000) / 100 : 0;

    let bestFunnel: { title: string; leads: number; views: number } | null = null;
    if (funnels.length) {
      const ranked = funnels
        .map((f: any) => ({
          title: f.title,
          views: f.total_views || 0,
          leads: leads30.find((l) => l.funnel_id === f.id)?.count || 0,
        }))
        .sort((a, b) => b.leads - a.leads || b.views - a.views);
      bestFunnel = ranked[0];
    }

    const stats = {
      creator: { name: profile?.full_name || "the creator", plan: effectivePlan },
      totals: {
        all_time_views: totalAllViews,
        all_time_leads: totalAllLeads,
        all_time_conversion_rate_percent: conversionRate,
        funnels_count: funnels.length,
        published_funnels_count: funnels.filter((f: any) => f.is_published).length,
      },
      views: { today: todayViews, last_7_days: weekViews, last_30_days: monthViews },
      leads: {
        today: leadsToday,
        last_7_days: leadsThisWeek,
        last_30_days: leads30.reduce((a, l) => a + l.count, 0),
      },
      best_funnel_last_30_days: bestFunnel,
      top_funnels: funnels.slice(0, 10).map((f: any) => ({
        title: f.title,
        published: !!f.is_published,
        total_views: f.total_views || 0,
        total_leads: f.total_leads || 0,
        total_payments: f.total_payments || 0,
      })),
    };

    // ---- Gemini ----
    const systemPrompt =
      `You are Nev AI, a friendly analytics assistant for creators on nFlow (a video funnel platform for Indian network marketers). ` +
      `Answer the creator's question using ONLY the JSON stats provided below. ` +
      `If a number is zero, say so plainly. If something is not in the stats, say you don't have that data yet. ` +
      `Keep answers short (1-3 sentences). Use Indian number formatting (e.g. 1,20,000). ` +
      `Never invent data, never mention "JSON" or "stats object". Speak naturally.\n\n` +
      `STATS (today is ${today}):\n${JSON.stringify(stats)}`;

    const contents: any[] = [];
    const trimmedHistory = (history || []).slice(-10);
    for (const m of trimmedHistory) {
      if (!m?.content || !m.role) continue;
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 2000) }],
      });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const aiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("[nev-ai] Gemini error", aiRes.status, errText);
      return json(200, {
        reply: "Nev AI is having trouble right now. Please try again in a moment.",
        ...(debug && { debug: { gemini_status: aiRes.status, gemini_body: errText, query_errors: errs } }),
      });
    }

    const aiJson = await aiRes.json();
    let reply =
      aiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n").trim() ||
      "Sorry, I couldn't generate a reply just now.";

    if (debug && errs.length) {
      reply += `\n\n[debug] query errors:\n- ${errs.join("\n- ")}`;
    }

    // ---- Increment usage ----
    const newCount = usedSoFar + 1;
    await safe("nev_ai_usage upsert", async () => {
      const { error } = await admin
        .from("nev_ai_usage")
        .upsert(
          { user_id: user.id, date: today, count: newCount, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" },
        );
      if (error) throw error;
      return null;
    }, null, errs);

    return json(200, { reply, usage: { used: newCount, limit: dailyLimit } });
  } catch (e: any) {
    console.error("[nev-ai] fatal", e);
    return json(200, {
      reply: debug
        ? `[debug] fatal: ${e?.message || String(e)}\nprior errors:\n- ${errs.join("\n- ")}`
        : "Something went wrong. Please try again.",
    });
  }
});
