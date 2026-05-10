import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Route as AuthRoute } from "@/routes/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Eye, EyeOff, Mail, Lock, User as UserIcon, Phone, Sparkles, ArrowLeft, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Stage = "email" | "login" | "signup" | "nevorai-otp" | "set-password";

interface NevoraiInfo {
  fullName?: string | null;
  isPro: boolean;
  hasNflowAccount?: boolean;
}

export default function AuthPage() {
  const search = AuthRoute.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { signIn, signUp, user, loading } = useAuth();

  const [stage, setStage] = useState<Stage>("email");
  useDocumentTitle(stage === "signup" ? "Get Started" : "Sign In");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: search.email || "",
    phone: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const [nevoraiInfo, setNevoraiInfo] = useState<NevoraiInfo | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [otpSendStatus, setOtpSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [otpShake, setOtpShake] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);
  const lastAutoSubmittedRef = useRef<string>("");
  const verifyOtpCodeRef = useRef<((code: string) => Promise<void>) | null>(null);

  const [autoCheckStatus, setAutoCheckStatus] = useState<"idle" | "checking" | "match" | "none">("idle");
  const [autoCheckInfo, setAutoCheckInfo] = useState<NevoraiInfo | null>(null);
  const lookupCacheRef = useRef<Map<string, { exists: boolean; isPro: boolean; fullName: string | null; hasNflowAccount: boolean }>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkStartRef = useRef<number>(0);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  useEffect(() => {
    if (stage !== "email") return;
    const email = form.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setAutoCheckStatus("idle");
      setAutoCheckInfo(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      return;
    }
    const cached = lookupCacheRef.current.get(email);
    if (cached) {
      if (cached.exists) {
        setAutoCheckStatus("match");
        setAutoCheckInfo({ fullName: cached.fullName, isPro: cached.isPro, hasNflowAccount: cached.hasNflowAccount });
      } else {
        setAutoCheckStatus("none");
        setAutoCheckInfo(null);
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAutoCheckStatus("checking");
      checkStartRef.current = Date.now();
      try {
        const { data, error } = await supabase.functions.invoke("verify-nevorai-member", { body: { email, mode: "lookup" } });
        if (controller.signal.aborted) return;
        if (error) throw error;
        const result = {
          exists: !!data?.exists,
          isPro: !!data?.isPro,
          fullName: data?.fullName ?? null,
          hasNflowAccount: !!data?.hasNflowAccount,
        };
        lookupCacheRef.current.set(email, result);
        const elapsed = Date.now() - checkStartRef.current;
        const wait = Math.max(0, 300 - elapsed);
        setTimeout(() => {
          if (controller.signal.aborted) return;
          if (result.exists) {
            setAutoCheckStatus("match");
            setAutoCheckInfo({ fullName: result.fullName, isPro: result.isPro, hasNflowAccount: result.hasNflowAccount });
          } else {
            setAutoCheckStatus("none");
            setAutoCheckInfo(null);
          }
        }, wait);
      } catch {
        if (!controller.signal.aborted) {
          setAutoCheckStatus("idle");
          setAutoCheckInfo(null);
        }
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.email, stage]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (stage !== "nevorai-otp") {
      setResendCount(0);
      setResendCooldown(0);
      setOtpSendStatus("idle");
      lastAutoSubmittedRef.current = "";
    }
  }, [stage]);

  const enterOtpFromAutoDetect = () => {
    if (!autoCheckInfo) return;
    setNevoraiInfo(autoCheckInfo);
    if (autoCheckInfo.hasNflowAccount) {
      setStage("login");
      return;
    }
    setStage("nevorai-otp");
    handleSendOtp();
  };

  useEffect(() => {
    if (stage !== "nevorai-otp") return;
    if (otp.length === 6 && !submitting && lastAutoSubmittedRef.current !== otp) {
      lastAutoSubmittedRef.current = otp;
      verifyOtpCodeRef.current?.(otp);
    }
  }, [otp, stage, submitting]);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  useEffect(() => {
    void router.preloadRoute({ to: "/dashboard" });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const resetToEmail = () => {
    setStage("email");
    setNevoraiInfo(null);
    setOtp("");
    setForm((f) => ({ ...f, password: "", name: "", phone: "" }));
    setAutoCheckStatus("idle");
    setAutoCheckInfo(null);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email) { toast.error("Please enter your email"); return; }
    const cached = lookupCacheRef.current.get(email);
    if (cached) {
      if (cached.exists) {
        setNevoraiInfo({ fullName: cached.fullName, isPro: cached.isPro, hasNflowAccount: cached.hasNflowAccount });
        if (cached.hasNflowAccount) { setStage("login"); return; }
        setStage("nevorai-otp");
        handleSendOtp();
        return;
      }
      setStage("signup");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-nevorai-member", { body: { email, mode: "lookup" } });
      if (error) throw error;
      if (data?.exists) {
        setNevoraiInfo({ fullName: data.fullName, isPro: !!data.isPro, hasNflowAccount: !!data.hasNflowAccount });
        if (data.hasNflowAccount) { setStage("login"); return; }
        setStage("nevorai-otp");
        return;
      }
      setStage("signup");
    } catch {
      setStage("signup");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    if (resendCount >= 3) { toast.error("Too many attempts. Please wait 10 minutes."); return; }
    setSubmitting(true);
    setOtpSendStatus("sending");
    try {
      const { data, error } = await supabase.functions.invoke("verify-nevorai-member", {
        body: { email: form.email.trim().toLowerCase(), mode: "send_otp" },
      });
      if (error) throw error;
      if (data?.otpSent) {
        setOtpSendStatus("sent");
        setResendCooldown(30);
        setResendCount((c) => c + 1);
        setOtp("");
        lastAutoSubmittedRef.current = "";
        toast.success(`Code sent to ${form.email}.`);
        setTimeout(() => otpInputRef.current?.focus(), 100);
      } else {
        setOtpSendStatus("failed");
        toast.error(data?.error || "Couldn't send code.");
      }
    } catch (e: any) {
      setOtpSendStatus("failed");
      toast.error(e?.message || "Couldn't send code.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtpCode = async (code: string) => {
    if (!/^\d{6}$/.test(code)) { toast.error("Enter the 6-digit code"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-nevorai-otp", {
        body: { email: form.email.trim().toLowerCase(), code },
      });
      if (error) throw error;
      if (!data?.success) {
        setOtpShake(true); setTimeout(() => setOtpShake(false), 500);
        setOtp(""); lastAutoSubmittedRef.current = "";
        otpInputRef.current?.focus();
        toast.error(data?.error || "Incorrect code.");
        return;
      }
      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (setErr) { toast.error("Verified but could not sign in."); setStage("login"); return; }
        toast.success("Welcome!");
        setForm((f) => ({ ...f, password: "" }));
        setStage("set-password");
      } else {
        toast.error("Verified, but session could not be created.");
        setStage("login");
      }
    } catch (e: any) {
      setOtpShake(true); setTimeout(() => setOtpShake(false), 500);
      toast.error(e?.message || "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => { e.preventDefault(); await verifyOtpCode(otp); };
  verifyOtpCodeRef.current = verifyOtpCode;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Please enter your name"); return; }
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    try {
      const { error } = await signUp(form.email, form.password, form.name, form.phone);
      if (error) { toast.error(error.message); return; }
      toast.success("Account created! Please check your email to verify.");
    } finally { setSubmitting(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      try {
        const { data: lockData } = await supabase.rpc("check_auth_lockout", { _email: form.email, _ip: null });
        const lock = lockData as { locked?: boolean; unlock_at?: string } | null;
        if (lock?.locked) {
          const unlockAt = lock.unlock_at ? new Date(lock.unlock_at) : null;
          const mins = unlockAt ? Math.max(1, Math.ceil((unlockAt.getTime() - Date.now()) / 60000)) : 30;
          toast.error(`Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
          return;
        }
      } catch { /* lockout RPC missing — proceed */ }

      const { error } = await signIn(form.email, form.password);
      void (async () => {
        try {
          await supabase.rpc("record_auth_attempt", { _email: form.email, _ip: null, _success: !error });
        } catch {
          return undefined;
        }
      })();

      if (error) { toast.error("Invalid email or password."); return; }
      toast.success("Welcome back!");
      navigate({ to: "/dashboard", replace: true });
    } finally { setSubmitting(false); }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) { toast.error(error.message || "Could not set password."); return; }
      toast.success("Password set.");
      navigate({ to: "/dashboard", replace: true });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle relative">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--color-brand-blue-deep) 12%, transparent) 0%, transparent 70%)" }} />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block"><Logo size="lg" showByline /></Link>
          <p className="text-sm mt-3" style={{ color: "var(--color-hero-muted)" }}>
            {stage === "email" && "Welcome — let's get you in."}
            {stage === "login" && "Welcome back! Enter your password."}
            {stage === "signup" && "Create your nFlow account."}
            {stage === "nevorai-otp" && (nevoraiInfo?.isPro ? "You're a Nevorai Pro member — verify to unlock free." : "You're part of the Nevorai family.")}
            {stage === "set-password" && "One last thing — set a password for next time."}
          </p>
        </div>

        <div className="auth-card p-8">
          {stage !== "email" && stage !== "set-password" && (
            <button type="button" onClick={resetToEmail} className="flex items-center gap-1 text-xs mb-4 hover:text-foreground transition-colors" style={{ color: "var(--color-hero-muted)" }}>
              <ArrowLeft size={14} /> Use a different email
            </button>
          )}

          {stage === "email" && (
            <form onSubmit={handleContinue} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                  <Input id="email" type="email" placeholder="you@example.com" className="auth-input pl-9" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                {autoCheckStatus === "checking" && (
                  <div className="flex items-center gap-2 text-xs px-1" style={{ color: "var(--color-hero-muted)" }}>
                    <Loader2 size={12} className="animate-spin" /> Checking your email…
                  </div>
                )}
                {autoCheckStatus === "match" && autoCheckInfo && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {autoCheckInfo.fullName ? `Welcome back, ${autoCheckInfo.fullName.split(" ")[0]}!` : "Welcome back!"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {autoCheckStatus === "match" ? (
                <Button type="button" variant="hero" className="w-full" size="lg" disabled={submitting} onClick={enterOtpFromAutoDetect} style={{ borderRadius: "12px" }}>
                  {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</span>)
                    : autoCheckInfo?.hasNflowAccount ? (<span className="flex items-center gap-2"><Lock size={16} /> Continue to log in</span>)
                    : (<span className="flex items-center gap-2"><ShieldCheck size={16} /> Send verification code</span>)}
                </Button>
              ) : (
                <Button variant="hero" className="w-full" size="lg" disabled={submitting || autoCheckStatus === "checking"} style={{ borderRadius: "12px" }}>
                  {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Checking…</span>) : "Continue"}
                </Button>
              )}

              <div className="text-center">
                <button type="button" onClick={() => setStage("login")} className="text-xs hover:underline" style={{ color: "var(--color-hero-muted)" }}>
                  Already have an nFlow account? <span className="text-primary">Log in</span>
                </button>
              </div>
            </form>
          )}

          {stage === "nevorai-otp" && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${nevoraiInfo?.isPro ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
                <div className="flex items-start gap-3">
                  <Sparkles className={nevoraiInfo?.isPro ? "text-primary" : "text-muted-foreground"} size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {nevoraiInfo?.fullName ? `Hi ${nevoraiInfo.fullName.split(" ")[0]} —` : "Welcome —"} we found your Nevorai account
                    </p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm">Verification code</Label>
                  <Input id="otp" ref={otpInputRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" autoFocus
                    className={`auth-input text-center tracking-[0.5em] text-lg ${otpShake ? "animate-shake border-destructive" : ""}`}
                    value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} disabled={submitting} />
                  <p className="text-xs" style={{ color: "var(--color-hero-muted)" }}>
                    {otpSendStatus === "sending" ? (<span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Sending…</span>)
                      : (<>Sent to <span className="text-foreground">{form.email}</span>. Expires in 10 min.</>)}
                  </p>
                </div>
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting || otp.length !== 6} style={{ borderRadius: "12px" }}>
                  {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Verifying…</span>)
                    : (<span className="flex items-center gap-2"><ShieldCheck size={16} /> Verify & continue</span>)}
                </Button>
                <Button type="button" variant="outline" className="w-full" size="lg" disabled={submitting || resendCooldown > 0 || resendCount >= 3} onClick={handleSendOtp}>
                  {resendCount >= 3 ? "Too many attempts" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </Button>
              </form>
            </div>
          )}

          {stage === "signup" && (
            !form.email.trim() ? (
              <div className="space-y-4 text-center py-6">
                <p className="text-sm" style={{ color: "var(--color-hero-muted)" }}>Please enter your email first.</p>
                <Button variant="hero" size="lg" className="w-full" onClick={resetToEmail} style={{ borderRadius: "12px" }}>Enter your email</Button>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Full Name <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                    <Input id="name" placeholder="Your full name" className="auth-input pl-9" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                    <Input className="auth-input pl-9 pr-16 opacity-90" value={form.email} readOnly />
                    <button type="button" onClick={resetToEmail} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline">Change</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Phone <span style={{ color: "var(--color-hero-muted)" }} className="text-xs">(optional)</span></Label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                    <Input id="phone" placeholder="+91 9876543210" className="auth-input pl-9" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <PasswordField form={form} setForm={setForm} showPassword={showPassword} setShowPassword={setShowPassword} />
                <Button variant="hero" className="w-full" size="lg" disabled={submitting} style={{ borderRadius: "12px" }}>
                  {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Creating account…</span>) : "Create Account"}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => setStage("login")} className="text-xs hover:underline" style={{ color: "var(--color-hero-muted)" }}>
                    Already have an account? <span className="text-primary">Log in</span>
                  </button>
                </div>
              </form>
            )
          )}

          {stage === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                  <Input className="auth-input pl-9" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>
              <PasswordField form={form} setForm={setForm} showPassword={showPassword} setShowPassword={setShowPassword} showForgot />
              <Button variant="hero" className="w-full" size="lg" disabled={submitting} style={{ borderRadius: "12px" }}>
                {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Signing in…</span>) : "Sign In"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={resetToEmail} className="text-xs hover:underline" style={{ color: "var(--color-hero-muted)" }}>
                  No account yet? <span className="text-primary">Create one</span>
                </button>
              </div>
            </form>
          )}

          {stage === "set-password" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="text-primary shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">You're signed in 🎉</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-hero-muted)" }}>Set a password so you can log in next time.</p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">New password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
                    <Input type={showPassword ? "text" : "password"} placeholder="At least 8 characters" className="auth-input pl-9 pr-10" autoFocus
                      value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting || form.password.length < 8} style={{ borderRadius: "12px" }}>
                  {submitting ? (<span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving…</span>)
                    : (<span className="flex items-center gap-2"><ShieldCheck size={16} /> Set password & continue</span>)}
                </Button>
                <Button type="button" variant="outline" className="w-full" size="lg" disabled={submitting} onClick={() => navigate({ to: "/dashboard" })}>
                  Skip for now
                </Button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--color-hero-muted)" }}>
          By continuing, you agree to our <Link to="/" className="text-primary hover:underline">Terms</Link> and <Link to="/" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

const PasswordField = ({ form, setForm, showPassword, setShowPassword, showForgot }: any) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label htmlFor="password" className="text-sm">Password <span className="text-destructive">*</span></Label>
      {showForgot && <Link to="/auth/reset-password" className="text-xs text-primary hover:underline">Forgot password?</Link>}
    </div>
    <div className="relative">
      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-hero-muted)" }} />
      <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" className="auth-input pl-9 pr-10" required
        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground" style={{ color: "var(--color-hero-muted)" }}>
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);
