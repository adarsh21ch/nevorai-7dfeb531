// Refund Request edge function — submit, approve, reject
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getCallerUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function isAdmin(svc: any, userId: string): Promise<boolean> {
  const { data } = await svc.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

async function getAdminWhatsApp(svc: any): Promise<string> {
  const { data } = await svc
    .from("platform_settings")
    .select("value")
    .eq("key", "support_whatsapp")
    .maybeSingle();
  return data?.value || "";
}

async function enqueueEmail(svc: any, to: string, subject: string, html: string) {
  try {
    await svc.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        subject,
        html,
        purpose: "transactional",
        template: "refund_notification",
      },
    });
  } catch (e) {
    console.warn("enqueue_email failed (non-fatal):", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const user = await getCallerUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ───── SUBMIT (user) ─────
    if (action === "submit") {
      const reason = (body.reason as string | undefined)?.slice(0, 1000) || null;

      // Find latest active paid sub
      const { data: sub } = await svc
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .neq("tier", "free")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) return json({ error: "No active paid subscription" }, 400);

      // 7-day window check
      const startedAt = sub.started_at ? new Date(sub.started_at) : null;
      if (!startedAt) return json({ error: "Subscription start date missing" }, 400);
      const expiresAt = new Date(startedAt.getTime() + 7 * 86400_000);
      if (new Date() > expiresAt) {
        return json({ error: "Guarantee window has expired" }, 400);
      }

      // Block duplicate
      const { data: existing } = await svc
        .from("refund_requests")
        .select("id, status")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .maybeSingle();
      if (existing) return json({ error: "A refund request already exists", id: existing.id }, 409);

      const { data: created, error: insertErr } = await svc
        .from("refund_requests")
        .insert({
          user_id: user.id,
          subscription_id: sub.id,
          payment_id: sub.razorpay_payment_id || null,
          plan: sub.plan_key,
          amount: sub.amount_paid || 0,
          reason,
          status: "pending",
        })
        .select()
        .single();

      if (insertErr) return json({ error: insertErr.message }, 500);

      // Notify all admins (in-app)
      const { data: admins } = await svc
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const { data: profile } = await svc
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", user.id)
        .maybeSingle();

      const userName = profile?.full_name || profile?.email || "User";

      if (admins && admins.length > 0) {
        const notifs = admins.map((a: any) => ({
          user_id: a.user_id,
          type: "refund_request",
          title: "New refund request",
          message: `${userName} requested a refund of ₹${sub.amount_paid || 0} (${sub.plan_key})`,
          data: {
            refund_id: created.id,
            user_id: user.id,
            payment_id: sub.razorpay_payment_id,
            amount: sub.amount_paid,
          },
        }));
        await svc.from("notifications").insert(notifs);
      }

      // Email admin via support_whatsapp / settings → look for admin email
      const { data: adminEmailSetting } = await svc
        .from("platform_settings")
        .select("value")
        .eq("key", "admin_notification_email")
        .maybeSingle();

      const adminEmail = adminEmailSetting?.value || "";
      if (adminEmail) {
        const html = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
            <h2 style="margin:0 0 12px">New refund request</h2>
            <p><b>User:</b> ${userName} (${profile?.email || "n/a"})</p>
            <p><b>Phone:</b> ${profile?.phone || "n/a"}</p>
            <p><b>Plan:</b> ${sub.plan_key}</p>
            <p><b>Amount:</b> ₹${sub.amount_paid || 0}</p>
            <p><b>Payment ID:</b> ${sub.razorpay_payment_id || "n/a"}</p>
            <p><b>Reason:</b> ${reason || "Not provided"}</p>
            <hr/>
            <p style="font-size:12px;color:#64748B">Review in Admin → Subscriptions → Refunds tab.</p>
          </div>`;
        await enqueueEmail(svc, adminEmail, `Refund request from ${userName} — ₹${sub.amount_paid}`, html);
      }

      return json({ success: true, refund_id: created.id });
    }

    // ───── ADMIN ACTIONS ─────
    const adminCheck = await isAdmin(svc, user.id);
    if (!adminCheck) return json({ error: "forbidden" }, 403);

    if (action === "approve" || action === "reject") {
      const refundId = body.refund_id as string;
      const adminNote = (body.admin_note as string | undefined)?.slice(0, 500) || null;
      if (!refundId) return json({ error: "refund_id required" }, 400);

      const { data: refund } = await svc
        .from("refund_requests")
        .select("*")
        .eq("id", refundId)
        .maybeSingle();
      if (!refund) return json({ error: "Refund not found" }, 404);
      if (refund.status !== "pending") return json({ error: "Already reviewed" }, 400);

      const newStatus = action === "approve" ? "approved" : "rejected";

      await svc
        .from("refund_requests")
        .update({
          status: newStatus,
          admin_note: adminNote,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", refundId);

      // On approve → downgrade user to free
      if (action === "approve" && refund.subscription_id) {
        await svc
          .from("user_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", refund.subscription_id);

        await svc.from("user_subscriptions").insert({
          user_id: refund.user_id,
          plan_key: "free",
          tier: "free",
          status: "active",
          billing_type: "free",
          amount_paid: 0,
          started_at: new Date().toISOString(),
        });
      }

      // Email user
      const { data: targetProfile } = await svc
        .from("profiles")
        .select("email, full_name")
        .eq("id", refund.user_id)
        .maybeSingle();

      if (targetProfile?.email) {
        if (action === "approve") {
          const html = `
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
              <h2 style="margin:0 0 12px">Your Nevorai refund has been processed</h2>
              <p>Hi ${targetProfile.full_name || "there"},</p>
              <p>Your refund of <b>₹${refund.amount}</b> has been approved and will reflect in your account within 5–7 business days via your original payment method.</p>
              <p>We hope to see you back on Nevorai soon.</p>
              <p style="margin-top:24px">— Team Nevorai<br/>Nevorai by Nevorai</p>
            </div>`;
          await enqueueEmail(svc, targetProfile.email, "Your Nevorai refund has been processed", html);
        } else {
          const html = `
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0F172A">
              <h2 style="margin:0 0 12px">Regarding your Nevorai refund request</h2>
              <p>Hi ${targetProfile.full_name || "there"},</p>
              <p>We reviewed your refund request. Unfortunately your request does not qualify for our 7-day guarantee${adminNote ? ` because: <b>${adminNote}</b>` : ""}.</p>
              <p>Please contact us on WhatsApp if you have questions.</p>
              <p style="margin-top:24px">— Team Nevorai<br/>Nevorai by Nevorai</p>
            </div>`;
          await enqueueEmail(svc, targetProfile.email, "Regarding your Nevorai refund request", html);
        }
      }

      // In-app notification to user
      await svc.from("notifications").insert({
        user_id: refund.user_id,
        type: action === "approve" ? "refund_approved" : "refund_rejected",
        title: action === "approve" ? "Refund approved" : "Refund request declined",
        message: action === "approve"
          ? `Your refund of ₹${refund.amount} has been approved. It will reflect in 5–7 business days.`
          : `Your refund request was declined.${adminNote ? " Reason: " + adminNote : ""}`,
        data: { refund_id: refund.id, payment_id: refund.payment_id },
      });

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("refund-request error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
