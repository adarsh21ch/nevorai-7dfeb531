// confirm-nevorai-otp
// Verifies the 6-digit OTP and either:
//   (a) signs in an existing nFlow account for that email, OR
//   (b) creates a brand-new nFlow account auto-linked to the Nevorai user.
// Pro members also get the Individual ('pro') plan flipped on; free Nevorai
// users just get nevorai_member=true with active=false (recognition only).
// Returns a Supabase session the client can set via supabase.auth.setSession.
//
// SELF-HEALING: If nevorai_member_registry row is missing, this function will
// call the Nevorai bridge directly to fetch user info. If bridge is also
// unreachable, it falls back to creating a free Nevorai-linked account
// (the OTP itself proves email ownership).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ConfirmRequest {
  email: string;
  code: string;
}

interface BridgeResponse {
  isPro?: boolean;
  plan?: string | null;
  fullName?: string | null;
  registeredAt?: string | null;
  callingAppUserId?: string | null;
  phone?: string | null;
  email?: string | null;
  exists?: boolean;
}

async function hashCode(code: string): Promise<string> {
  const enc = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function callNevoraiBridge(email: string): Promise<BridgeResponse | null> {
  const url = Deno.env.get("NEVORAI_BRIDGE_URL");
  const secret = Deno.env.get("NEVORAI_BRIDGE_SECRET");

  if (!url || !secret || url.startsWith("placeholder") || secret.startsWith("placeholder")) {
    console.warn("[confirm-nevorai-otp] Bridge not configured");
    return null;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      console.error(`[confirm-nevorai-otp] Bridge ${res.status}: ${await res.text()}`);
      return null;
    }
    return (await res.json()) as BridgeResponse;
  } catch (e) {
    console.error("[confirm-nevorai-otp] Bridge call failed:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ConfirmRequest;
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();

    if (!email || !code || !/^\d{6}$/.test(code)) {
      return jsonError("Valid email and 6-digit code required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const codeHash = await hashCode(code);

    // Find latest unconsumed OTP
    const { data: otp, error: otpErr } = await supabase
      .from("member_otps")
      .select("*")
      .eq("email", email)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr || !otp) {
      return jsonError("Code expired or not found. Please request a new one.", 400);
    }
    if (otp.attempts >= 5) {
      return jsonError("Too many attempts. Request a new code.", 429);
    }
    if (otp.code_hash !== codeHash) {
      await supabase
        .from("member_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      return jsonError("Incorrect code", 400);
    }

    // Mark consumed
    await supabase
      .from("member_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    // Look up registry for plan + name + phone
    let { data: registry } = await supabase
      .from("nevorai_member_registry")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    // SELF-HEAL: If no cached registry row, try the bridge live
    if (!registry) {
      console.log(`[confirm-nevorai-otp] No registry row for ${email}, calling bridge`);
      const bridge = await callNevoraiBridge(email);
      if (bridge) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: upserted, error: upErr } = await supabase
          .from("nevorai_member_registry")
          .upsert(
            {
              email: bridge.email?.toLowerCase() || email,
              phone: bridge.phone || null,
              full_name: bridge.fullName || null,
              is_pro: !!bridge.isPro,
              plan: bridge.plan || null,
              calling_app_user_id: bridge.callingAppUserId || null,
              registered_at: bridge.registeredAt || null,
              last_synced_at: new Date().toISOString(),
              expires_at: expiresAt,
              source: "bridge_self_heal",
            },
            { onConflict: "email" },
          )
          .select()
          .maybeSingle();
        if (upErr) {
          console.error("[confirm-nevorai-otp] Self-heal upsert failed:", upErr);
        }
        registry = upserted;
      }
    }

    // Final fallback: OTP already proves email ownership AND verify-nevorai-member
    // already confirmed this user exists on Nevorai before issuing the code.
    // Treat as a free Nevorai-linked account.
    const safeRegistry = registry ?? {
      email,
      full_name: null,
      phone: null,
      is_pro: false,
      plan: null,
    };

    const isPro = !!safeRegistry.is_pro;

    // Find or create the nFlow auth user for this email
    let userId: string | null = null;
    let createdNew = false;
    let session: any = null;

    // Try to find existing auth user via profiles (email is stored there)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      // Create a brand-new account
      const tempPassword = randomPassword();
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: safeRegistry.full_name || "",
          phone: safeRegistry.phone || "",
          source: "nevorai_bridge",
        },
      });
      if (createErr || !created.user) {
        console.error("[confirm-nevorai-otp] createUser failed:", createErr);
        return jsonError("Could not create account. Please try again.", 500);
      }
      userId = created.user.id;
      createdNew = true;
    }

    // Update profile flags + identifying info.
    // Only set nevorai_member=true for actual Pro members (the flag drives
    // the "Nevorai Member" badge + welcome popup + free Individual access).
    // Free Nevorai users get a linked account but no member benefits.
    await supabase
      .from("profiles")
      .update({
        nevorai_member: isPro,
        nevorai_member_active: isPro,
        nevorai_member_source: "bridge",
        nevorai_member_granted_at: isPro ? new Date().toISOString() : null,
        nevorai_member_last_checked_at: new Date().toISOString(),
        ...(safeRegistry.full_name ? { full_name: safeRegistry.full_name } : {}),
        ...(safeRegistry.phone ? { phone: safeRegistry.phone } : {}),
      })
      .eq("id", userId);

    if (isPro) {
      // Grant / refresh Individual plan ('pro')
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existingSub } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      // IMPORTANT: plan_key must match a row in admin_subscription_plans
      // (which is keyed by 'pro_monthly', not 'pro'). Otherwise usePlan
      // can't resolve plan limits and the user falls back to FREE limits.
      if (existingSub) {
        await supabase
          .from("user_subscriptions")
          .update({
            plan_key: "pro_monthly",
            tier: "pro",
            status: "active",
            billing_type: "nevorai_member",
            expires_at: expiresAt,
            started_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);
      } else {
        await supabase.from("user_subscriptions").insert({
          user_id: userId,
          plan_key: "pro_monthly",
          tier: "pro",
          status: "active",
          billing_type: "nevorai_member",
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
        });
      }
    }

    // Issue a session via magic-link generation (server-side, no email sent)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (!linkErr && linkData?.properties?.hashed_token) {
      // Exchange hashed_token for a session using verifyOtp
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      });
      if (!verifyErr && verifyData.session) {
        session = {
          access_token: verifyData.session.access_token,
          refresh_token: verifyData.session.refresh_token,
        };
      } else {
        console.error("[confirm-nevorai-otp] verifyOtp failed:", verifyErr);
      }
    } else {
      console.error("[confirm-nevorai-otp] generateLink failed:", linkErr);
    }

    // Log the event
    await supabase.from("member_access_logs").insert({
      user_id: userId,
      email,
      event_type: createdNew ? "account_created_via_otp" : "account_linked_via_otp",
      source: "bridge_otp",
      metadata: { isPro, plan: safeRegistry.plan, createdNew, hadRegistry: !!registry },
    });

    return new Response(
      JSON.stringify({
        success: true,
        createdNew,
        isPro,
        plan: isPro ? "Individual" : "Free",
        session,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[confirm-nevorai-otp] Unhandled error:", e);
    return jsonError("Internal error", 500);
  }
});
