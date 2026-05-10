// verify-nevorai-member
// Looks up a user in the Nevorai bridge. In `lookup` mode returns whether
// the email exists in Nevorai at all (any user) and whether they are Pro.
// In `send_otp` mode generates a 6-digit OTP and queues an email — works for
// BOTH free and Pro Nevorai users (Pro gets Individual plan on confirm,
// free just gets a recognized linked nFlow account).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VerifyRequest {
  email?: string;
  phone?: string;
  mode?: "lookup" | "send_otp";
}

interface BridgeResponse {
  isPro: boolean;
  plan?: string | null;
  fullName?: string | null;
  registeredAt?: string | null;
  callingAppUserId?: string | null;
  phone?: string | null;
  email?: string | null;
  // Optional explicit existence flag — if the bridge sets this we use it.
  // Otherwise we infer existence from fullName / registeredAt / callingAppUserId.
  exists?: boolean;
}

async function callNevoraiBridge(
  email: string | undefined,
  phone: string | undefined,
): Promise<BridgeResponse | null> {
  const url = Deno.env.get("NEVORAI_BRIDGE_URL");
  const secret = Deno.env.get("NEVORAI_BRIDGE_SECRET");

  if (!url || !secret || url.startsWith("placeholder") || secret.startsWith("placeholder")) {
    console.warn("[verify-nevorai-member] Bridge not configured — returning null");
    return null;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ email, phone }),
    });

    if (!res.ok) {
      console.error(`[verify-nevorai-member] Bridge ${res.status}: ${await res.text()}`);
      return null;
    }
    return (await res.json()) as BridgeResponse;
  } catch (e) {
    console.error("[verify-nevorai-member] Bridge call failed:", e);
    return null;
  }
}

async function generateOtp(): Promise<{ code: string; hash: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const enc = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { code, hash };
}

// Infer "this email is a known Nevorai user" even if the bridge doesn't
// explicitly return `exists`. Some bridge responses for free users may only
// return matched contact details (email / phone) and omit profile fields.
function inferExists(
  b: BridgeResponse | null,
  lookup: { email?: string; phone?: string },
): boolean {
  if (!b) return false;
  if (b.exists === true) return true;
  if (b.isPro) return true;

  const requestedEmail = lookup.email?.trim().toLowerCase();
  const requestedPhone = lookup.phone?.trim();
  const returnedEmail = b.email?.trim().toLowerCase();
  const returnedPhone = b.phone?.trim();

  return !!(
    b.callingAppUserId ||
    b.registeredAt ||
    b.fullName ||
    (requestedEmail && returnedEmail && requestedEmail === returnedEmail) ||
    (requestedPhone && returnedPhone && requestedPhone === returnedPhone) ||
    (b.plan && String(b.plan).trim())
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as VerifyRequest;
    const email = body.email?.trim().toLowerCase();
    const phone = body.phone?.trim();
    const mode = body.mode ?? "lookup";

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "email or phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache lookup
    let cached: any = null;
    if (email) {
      const { data } = await supabase
        .from("nevorai_member_registry")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      cached = data;
    }
    if (!cached && phone) {
      const { data } = await supabase
        .from("nevorai_member_registry")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
      cached = data;
    }

    const isFresh = cached && new Date(cached.expires_at) > new Date();
    let memberData: BridgeResponse | null = null;

    if (isFresh) {
      memberData = {
        isPro: cached.is_pro,
        plan: cached.plan,
        fullName: cached.full_name,
        registeredAt: cached.registered_at,
        callingAppUserId: cached.calling_app_user_id,
        email: cached.email,
        phone: cached.phone,
        exists: !!(cached.calling_app_user_id || cached.registered_at || cached.full_name || cached.is_pro),
      };
    } else {
      memberData = await callNevoraiBridge(email, phone);

      if (memberData !== null) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const upsertEmail = memberData.email?.toLowerCase() || email;
        const upsertPhone = memberData.phone || phone;

        if (upsertEmail) {
          const { error: upsertErr } = await supabase
            .from("nevorai_member_registry")
            .upsert(
              {
                email: upsertEmail,
                phone: upsertPhone || null,
                full_name: memberData.fullName || null,
                is_pro: !!memberData.isPro,
                plan: memberData.plan || null,
                calling_app_user_id: memberData.callingAppUserId || null,
                registered_at: memberData.registeredAt || null,
                last_synced_at: new Date().toISOString(),
                expires_at: expiresAt,
                source: "bridge",
              },
              { onConflict: "email" },
            );
          if (upsertErr) {
            console.error("[verify-nevorai-member] Registry upsert FAILED:", JSON.stringify(upsertErr));
          } else {
            console.log(`[verify-nevorai-member] Registry upserted for ${upsertEmail} (mode=${mode}, isPro=${memberData.isPro})`);
          }
        } else {
          console.warn("[verify-nevorai-member] No email available to upsert registry");
        }
      }
    }

    const exists = inferExists(memberData, { email, phone });
    const isPro = memberData?.isPro === true;

    // Check if an nFlow account already exists for this email — if so, the
    // user should log in with their password instead of OTP.
    let hasNflowAccount = false;
    const checkEmail = (memberData?.email || email)?.toLowerCase();
    if (checkEmail) {
      try {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", checkEmail)
          .maybeSingle();
        hasNflowAccount = !!existingProfile;
      } catch (e) {
        console.warn("[verify-nevorai-member] profile lookup failed:", e);
      }
    }

    // Lookup-only OR not found at all
    if (mode === "lookup" || !exists) {
      return new Response(
        JSON.stringify({
          // Backwards-compat field
          isMember: isPro,
          // New explicit fields
          exists,
          isPro,
          hasNflowAccount,
          fullName: memberData?.fullName ?? null,
          email: memberData?.email ?? null,
          phone: memberData?.phone ?? null,
          plan: memberData?.plan ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Recognized Nevorai user but already has an nFlow account → don't send OTP
    if (hasNflowAccount) {
      return new Response(
        JSON.stringify({
          isMember: isPro,
          exists: true,
          isPro,
          hasNflowAccount: true,
          otpSent: false,
          fullName: memberData?.fullName ?? null,
          email: checkEmail,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // send_otp mode + recognized Nevorai user (Pro OR free)
    const targetEmail = memberData?.email || email;
    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "No email available to send OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit: max 3 sends per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("member_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", targetEmail)
      .gte("created_at", oneHourAgo);

    if ((recentCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many code requests. Please wait an hour and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { code, hash } = await generateOtp();

    await supabase.from("member_otps").insert({
      email: targetEmail,
      code_hash: hash,
      ip_address: req.headers.get("x-forwarded-for") || null,
    });

    // INSTANT SEND — bypass queue. OTP must arrive in seconds, not minutes.
    const subject = `Your nFlow verification code: ${code}`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:480px;margin:0 auto;text-align:center;">
    <p style="font-size:15px;color:#555;margin:0 0 8px;">Your verification code</p>
    <p style="font-size:40px;font-weight:700;letter-spacing:10px;margin:16px 0 24px;color:#111;">${code}</p>
    <p style="font-size:13px;color:#888;margin:0 0 4px;">This code expires in 10 minutes.</p>
    <p style="font-size:13px;color:#888;margin:0 0 24px;">If you didn't request this, ignore this email.</p>
    <p style="font-size:13px;color:#aaa;margin:0;">— Team nFlow</p>
  </div>
</body></html>`;
    const text = `Your verification code: ${code}\n\nThis code expires in 10 minutes.\nIf you didn't request this, ignore this email.\n\n— Team nFlow`;

    async function sendOnce(): Promise<boolean> {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-gmail-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              to: targetEmail,
              subject,
              html,
              text,
              sender_name: "nFlow",
            }),
            signal: ctrl.signal,
          },
        );
        clearTimeout(timer);
        if (!res.ok) {
          console.error(`[verify-nevorai-member] OTP send ${res.status}: ${await res.text()}`);
          return false;
        }
        return true;
      } catch (e) {
        clearTimeout(timer);
        console.error("[verify-nevorai-member] OTP send error:", e);
        return false;
      }
    }

    let sent = await sendOnce();
    if (!sent) {
      console.warn("[verify-nevorai-member] First send failed, retrying once");
      sent = await sendOnce();
    }
    if (!sent) {
      // Roll back the OTP row so the user can retry without burning rate limit
      await supabase.from("member_otps").delete().eq("email", targetEmail).eq("code_hash", hash);
      return new Response(
        JSON.stringify({
          error: "Could not send OTP email. Please check your email address or try again in a few seconds.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        isMember: isPro, // backwards-compat
        exists: true,
        isPro,
        otpSent: true,
        email: targetEmail,
        fullName: memberData?.fullName ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[verify-nevorai-member] Unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
