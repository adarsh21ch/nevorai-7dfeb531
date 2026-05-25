// WhatsApp sequence runner.
// Called by cron-job.org every hour. Processes due enrollments in
// whatsapp_sequence_enrollments, sends the current step's template via
// whatsapp-send-text, then advances or completes the enrollment.
//
// Optional security: set CRON_SECRET in Edge Function secrets and pass
// header `x-cron-secret: <same value>` from cron-job.org.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Enrollment {
  id: string;
  phone_number: string;
  user_id: string | null;
  automation_id: string;
  current_step: number;
  status: string;
}

interface Step {
  id: string;
  step_order: number;
  delay_hours: number;
  template_id: string | null;
  stop_if_subscribed: boolean;
}

interface Template {
  id: string;
  name: string;
  body: string;
  media_key: string | null;
}

function daysBetween(target: Date | null, from: Date): number {
  if (!target) return 0;
  const ms = target.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

async function resolveVariables(
  supabase: SupabaseClient,
  enrollment: Enrollment,
): Promise<Record<string, string>> {
  const appLink = Deno.env.get("NEVORAI_APP_LINK") || "https://flow.nevorai.com";

  let name = "there";
  let plan = "";
  let expiry = "";
  let daysLeft = "0";

  if (enrollment.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", enrollment.user_id)
      .maybeSingle();
    if (profile?.full_name) {
      name = String(profile.full_name).split(" ")[0] || "there";
    }

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("plan, expires_at, status")
      .eq("user_id", enrollment.user_id)
      .in("status", ["active", "trial"])
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      plan = sub.plan || "";
      if (sub.expires_at) {
        const d = new Date(sub.expires_at);
        expiry = d.toISOString().slice(0, 10);
        daysLeft = String(daysBetween(d, new Date()));
      }
    }
  } else {
    // Try to find name from whatsapp_leads
    const { data: lead } = await supabase
      .from("whatsapp_leads")
      .select("name")
      .eq("phone_number", enrollment.phone_number)
      .maybeSingle();
    if (lead?.name) name = String(lead.name).split(" ")[0] || "there";
  }

  return { name, plan, expiry, days_left: daysLeft, link: appLink };
}

async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function sendMessage(
  serviceRoleKey: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send-text`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ to: to.replace(/\D/g, ""), text }),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: JSON.stringify(json).slice(0, 300) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const summary = { processed: 0, sent: 0, converted: 0, completed: 0, errors: 0 };

  const { data: due, error: dueErr } = await supabase
    .from("whatsapp_sequence_enrollments")
    .select("id, phone_number, user_id, automation_id, current_step, status")
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .limit(500);

  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const enrollments = (due || []) as Enrollment[];
  summary.processed = enrollments.length;

  // Cache automations + steps to avoid refetching per enrollment
  const stepsCache = new Map<string, Step[]>();
  const templateCache = new Map<string, Template>();

  for (const enr of enrollments) {
    try {
      // Load steps for this automation
      let steps = stepsCache.get(enr.automation_id);
      if (!steps) {
        const { data: stepRows } = await supabase
          .from("whatsapp_automation_steps")
          .select("id, step_order, delay_hours, template_id, stop_if_subscribed")
          .eq("automation_id", enr.automation_id)
          .order("step_order", { ascending: true });
        steps = (stepRows || []) as Step[];
        stepsCache.set(enr.automation_id, steps);
      }

      const currentStep = steps[enr.current_step];
      if (!currentStep) {
        // No step at this index → mark completed
        await supabase
          .from("whatsapp_sequence_enrollments")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", enr.id);
        summary.completed++;
        continue;
      }

      // Stop-if-subscribed check
      if (currentStep.stop_if_subscribed && await hasActiveSubscription(supabase, enr.user_id)) {
        await supabase
          .from("whatsapp_sequence_enrollments")
          .update({ status: "converted", completed_at: new Date().toISOString() })
          .eq("id", enr.id);
        await supabase.rpc("increment_automation_converted", { p_automation_id: enr.automation_id })
          .then(() => {})
          .catch(async () => {
            // Fallback if RPC missing — direct update
            const { data: aut } = await supabase
              .from("whatsapp_automations")
              .select("total_converted")
              .eq("id", enr.automation_id)
              .maybeSingle();
            const next = (aut?.total_converted ?? 0) + 1;
            await supabase
              .from("whatsapp_automations")
              .update({ total_converted: next })
              .eq("id", enr.automation_id);
          });
        summary.converted++;
        continue;
      }

      // Load template
      if (!currentStep.template_id) {
        summary.errors++;
        continue;
      }
      let tmpl = templateCache.get(currentStep.template_id);
      if (!tmpl) {
        const { data: tRow } = await supabase
          .from("whatsapp_templates")
          .select("id, name, body, media_key")
          .eq("id", currentStep.template_id)
          .maybeSingle();
        if (!tRow) { summary.errors++; continue; }
        tmpl = tRow as Template;
        templateCache.set(tmpl.id, tmpl);
      }

      const vars = await resolveVariables(supabase, enr);
      const text = renderTemplate(tmpl.body, vars);

      const sendRes = await sendMessage(serviceRoleKey, enr.phone_number, text);
      if (!sendRes.ok) {
        summary.errors++;
        console.error(`[runner] send failed for ${enr.phone_number}: ${sendRes.error}`);
        continue;
      }
      summary.sent++;

      // Advance
      const nextIdx = enr.current_step + 1;
      const nextStep = steps[nextIdx];
      if (nextStep) {
        const nextAt = new Date(Date.now() + (nextStep.delay_hours || 0) * 3600 * 1000).toISOString();
        await supabase
          .from("whatsapp_sequence_enrollments")
          .update({ current_step: nextIdx, next_send_at: nextAt })
          .eq("id", enr.id);
      } else {
        await supabase
          .from("whatsapp_sequence_enrollments")
          .update({
            current_step: nextIdx,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", enr.id);
        summary.completed++;
      }
    } catch (e) {
      summary.errors++;
      console.error(`[runner] enrollment ${enr.id} failed:`, (e as Error).message);
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
