import { createServerFn } from "@tanstack/react-start";

// Request a password reset email. We mint the Supabase recovery link
// server-side via the admin API and email it through our own transport
// (Gmail first, Resend fallback) — bypassing Supabase's rate-limited
// default SMTP that was silently dropping reset emails.
//
// Always returns { ok: true } regardless of whether the email exists,
// to prevent account enumeration. Real errors are logged server-side.
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("invalid_email");
    return { email };
  })
  .handler(async ({ data }) => {
    try {
      const supabaseUrl =
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        "https://dnyjlmtiliqkpxwsgqyn.supabase.co";

      // Supabase's edge gateway requires an apikey header to route to the
      // function, even when verify_jwt = false. Without this, the call 401s
      // before our function ever runs — which is why reset emails were never
      // being sent. Use service role if available, anon/publishable as fallback.
      const apiKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "";

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["apikey"] = apiKey;
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/request-password-reset`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: data.email }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[password-reset] edge function failed", res.status, text);
        return { ok: false };
      }
    } catch (err: any) {
      console.error("[password-reset] unexpected error", err?.message || err);
      return { ok: false };
    }
    return { ok: true };
  });
