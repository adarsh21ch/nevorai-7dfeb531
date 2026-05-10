import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Shield } from "lucide-react";
import logoImg from "@/assets/nevorai-flow-logo.png";

interface CodeGateScreenProps {
  funnelId: string;
  funnelTitle: string;
  creatorName?: string;
  onSuccess: () => void;
  onLoginClick: () => void;
  isDark: boolean;
}

export const CodeGateScreen = ({ funnelId, funnelTitle, creatorName, onSuccess, onLoginClick, isDark }: CodeGateScreenProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    const key = `nf_code_lock_${funnelId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const { lockedUntil } = JSON.parse(stored);
      if (Date.now() < lockedUntil) {
        setLocked(true);
        setLockRemaining(Math.ceil((lockedUntil - Date.now()) / 1000));
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [funnelId]);

  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      const key = `nf_code_lock_${funnelId}`;
      const stored = localStorage.getItem(key);
      if (!stored) { setLocked(false); return; }
      const { lockedUntil } = JSON.parse(stored);
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) { localStorage.removeItem(key); setLocked(false); setLockRemaining(0); }
      else setLockRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [locked, funnelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || locked) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-funnel-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ funnel_id: funnelId, code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(`nf_code_verified_${funnelId}`, JSON.stringify({ verified: true, verifiedAt: Date.now() }));
        onSuccess();
      } else {
        const attemptKey = `nf_code_attempts_${funnelId}`;
        const stored = localStorage.getItem(attemptKey);
        let attempts = stored ? JSON.parse(stored).count : 0;
        attempts++;
        if (attempts >= 5) {
          const lockedUntil = Date.now() + 60 * 60 * 1000;
          localStorage.setItem(`nf_code_lock_${funnelId}`, JSON.stringify({ lockedUntil }));
          localStorage.removeItem(attemptKey);
          setLocked(true); setLockRemaining(3600);
        } else localStorage.setItem(attemptKey, JSON.stringify({ count: attempts }));
        setError("That code doesn't match. Please check and try again.");
        setShake(true); setTimeout(() => setShake(false), 500);
      }
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  const bg = isDark ? "#09090b" : "#ffffff";
  const cardBg = isDark ? "#141419" : "#f8f9fa";
  const border = isDark ? "#27272a" : "#e5e7eb";
  const text = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#94a3b8" : "#64748b";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={logoImg} alt="nFlow" className="h-7 w-7" />
          <div className="flex items-baseline text-[16px]" style={{ lineHeight: 1 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, color: text, letterSpacing: "-0.02em" }}>Nevorai</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, color: text, letterSpacing: "-0.03em", marginLeft: "4px" }}>Flow</span>
          </div>
        </div>
        <div className="rounded-2xl p-8" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Shield size={28} className="text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold mb-1" style={{ color: text }}>{funnelTitle}</h2>
          {creatorName && <p className="text-sm mb-4" style={{ color: textMuted }}>by {creatorName}</p>}
          <p className="text-sm font-medium mb-1" style={{ color: text }}>This program requires an access code</p>
          <p className="text-xs mb-6" style={{ color: textMuted }}>Enter the code shared with you to unlock this content</p>
          {locked ? (
            <div className="text-center">
              <p className="text-sm font-medium text-amber-500 mb-2">Too many attempts</p>
              <p className="text-xs" style={{ color: textMuted }}>Please try again in {Math.floor(lockRemaining / 60)}:{(lockRemaining % 60).toString().padStart(2, "0")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter access code"
                className={`text-center uppercase tracking-[0.15em] font-mono text-lg h-12 ${shake ? "animate-shake" : ""} ${error ? "border-red-500" : ""}`}
                style={{ background: isDark ? "#09090b" : "#f1f5f9", borderColor: error ? "#ef4444" : border, color: text }}
                disabled={loading} autoFocus />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button type="submit" className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl" disabled={loading || !code.trim()}>
                {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Verifying...</> : "Unlock Program →"}
              </Button>
            </form>
          )}
          <p className="text-[10px] mt-4 flex items-center justify-center gap-1" style={{ color: textMuted }}>
            <Lock size={10} /> Secure & encrypted verification
          </p>
        </div>
        <button onClick={onLoginClick} className="mt-4 text-xs hover:underline" style={{ color: textMuted }}>Already have access? Continue here</button>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}.animate-shake{animation:shake 0.4s ease-in-out}`}</style>
    </div>
  );
};
