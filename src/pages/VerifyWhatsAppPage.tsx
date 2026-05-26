import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, MessageCircle, LogOut } from "lucide-react";

export default function VerifyWhatsAppPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const p = profile as any;

  const initialPhone = (p?.whatsapp_number || profile?.phone || "").replace(/\D/g, "").slice(-10);
  const [phone, setPhone] = useState(initialPhone);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">(initialPhone.length === 10 ? "otp" : "phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const autoSentRef = useRef(false);

  // Redirect away if already verified
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (p?.whatsapp_verified) navigate({ to: "/dashboard", replace: true });
  }, [p?.whatsapp_verified, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = useCallback(async (clean: string) => {
    if (clean.length !== 10) { toast.error("Enter a valid 10-digit number"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-send-otp", {
      body: { phone_number: clean, user_id: user?.id },
    });
    // supabase.functions.invoke puts non-2xx responses into `error` and
    // wipes `data`. Try to read the JSON body from the error response so we
    // can surface the real backend message ("template not approved", "rate
    // limit", "already registered", etc.) instead of a generic toast.
    let payload: any = data;
    if (!payload && error && (error as any).context?.json) {
      try { payload = await (error as any).context.json(); } catch { /* noop */ }
    } else if (!payload && error && (error as any).context instanceof Response) {
      try { payload = await (error as any).context.clone().json(); } catch { /* noop */ }
    }
    setSending(false);
    if (error || payload?.error) {
      const code = payload?.error;
      if (code === "already_registered") {
        toast.error(payload?.message || "This WhatsApp number is already registered. Please login instead.");
        return;
      }
      if (code === "rate_limit") {
        toast.error(payload?.message || "Please wait 60 seconds before requesting another OTP.");
        setCooldown(60);
        return;
      }
      console.error("send-otp failed", { code, payload, error });
      toast.error(payload?.message || "Could not send OTP. Try again.");
      return;
    }
    toast.success("OTP sent on WhatsApp");
    setStep("otp");
    setCooldown(30);
    setOtp("");
    setTimeout(() => otpRef.current?.focus(), 100);
  }, [user?.id]);


  // Auto-send when arriving with a phone already on file
  useEffect(() => {
    if (autoSentRef.current) return;
    if (loading || !user) return;
    if (step === "otp" && phone.length === 10 && !p?.whatsapp_verified) {
      autoSentRef.current = true;
      void sendOtp(phone);
    }
  }, [loading, user, step, phone, p?.whatsapp_verified, sendOtp]);

  const verify = async () => {
    if (lockedUntil && Date.now() < lockedUntil) {
      const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
      toast.error(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      return;
    }
    if (otp.length < 6) return;
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-verify-otp", {
      body: { phone_number: phone, code: otp.trim(), user_id: user!.id },
    });
    if (error || !data?.verified) {
      const next = attempts + 1;
      setAttempts(next);
      setOtp("");
      if (next >= 3) {
        setLockedUntil(Date.now() + 10 * 60 * 1000);
        toast.error("Too many attempts. Try again in 10 minutes.");
      } else {
        toast.error(`Wrong OTP. ${3 - next} attempt${3 - next === 1 ? "" : "s"} left.`);
      }
      setVerifying(false);
      return;
    }
    // Mark profile
    const { error: upErr } = await (supabase as any)
      .from("profiles")
      .update({ whatsapp_number: phone, whatsapp_verified: true })
      .eq("id", user!.id);
    if (upErr) {
      setVerifying(false);
      if ((upErr.message || "").toLowerCase().includes("duplicate")) {
        toast.error("This number is already registered to another account.");
      } else {
        toast.error("Verified, but could not save. Try again.");
      }
      return;
    }
    await refreshProfile();
    toast.success("WhatsApp verified!");
    navigate({ to: "/dashboard", replace: true });
  };

  // Auto-submit OTP at 6 digits
  useEffect(() => {
    if (step === "otp" && otp.length === 6 && !verifying) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const locked = lockedUntil && Date.now() < lockedUntil;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle relative">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size="lg" />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MessageCircle size={12} /> WhatsApp verification required
          </div>
          <h1 className="font-heading font-bold text-2xl mt-3">Verify your WhatsApp</h1>
          <p className="text-sm mt-2" style={{ color: "var(--color-hero-muted)" }}>
            {step === "phone"
              ? "Enter your WhatsApp number to receive an OTP."
              : "We sent a 6-digit code to your WhatsApp."}
          </p>
        </div>

        <div className="auth-card p-6 space-y-4">
          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm">WhatsApp Number <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 rounded-md bg-muted text-sm font-medium">+91</span>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="9876543210"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    autoFocus
                  />
                </div>
              </div>
              <Button variant="hero" size="lg" className="w-full" disabled={sending || phone.length !== 10} onClick={() => sendOtp(phone)}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : "Send OTP"}
              </Button>
            </>
          ) : (
            <>
              <div className="text-xs text-center" style={{ color: "var(--color-hero-muted)" }}>
                Sent to <span className="text-foreground font-medium">+91 {phone}</span>
                {" · "}
                <button onClick={() => { setStep("phone"); autoSentRef.current = false; }} className="text-primary hover:underline">change</button>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">6-digit OTP</Label>
                <Input
                  ref={otpRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  className="text-center tracking-[0.5em] text-lg"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!!locked || verifying}
                />
              </div>
              <Button variant="hero" size="lg" className="w-full" disabled={verifying || otp.length !== 6 || !!locked} onClick={verify}>
                {verifying
                  ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Verifying…</span>
                  : <span className="flex items-center gap-2"><ShieldCheck size={16} /> Verify & continue</span>}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={sending || cooldown > 0 || !!locked}
                onClick={() => sendOtp(phone)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending…" : "Resend OTP"}
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
            className="w-full flex items-center justify-center gap-1 text-xs pt-2 hover:text-foreground"
            style={{ color: "var(--color-hero-muted)" }}
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--color-hero-muted)" }}>
          One verified WhatsApp number = one account. This keeps the platform spam-free.
        </p>
      </div>
    </div>
  );
}
