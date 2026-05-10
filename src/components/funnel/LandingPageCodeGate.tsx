import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Eye, EyeOff, Shield } from "lucide-react";
import logoImg from "@/assets/nevorai-flow-logo.png";

interface LandingPageCodeGateProps {
  pageId: string;
  pageTitle: string;
  message?: string | null;
  onSuccess: () => void;
}

export const LandingPageCodeGate = ({ pageId, pageTitle, message, onSuccess }: LandingPageCodeGateProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading || attempts >= 5) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-landing-page-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ page_id: pageId, code: code.trim() }),
        },
      );

      const data = await res.json();

      if (data.success) {
        try {
          localStorage.setItem(
            `nf_lp_verified_${pageId}`,
            JSON.stringify({ verified: true, verifiedAt: Date.now() }),
          );
        } catch {}
        onSuccess();
      } else {
        setAttempts((a) => a + 1);
        setError(data.message || "Incorrect code. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#09090b" }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src={logoImg} alt="nFlow" className="h-7 w-7" />
          <div className="flex items-baseline text-[16px]" style={{ lineHeight: 1 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>Nevorai</span>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginLeft: "4px" }}>Flow</span>
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "#141419", border: "1px solid #27272a" }}>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Shield size={28} className="text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold mb-1 text-white">{pageTitle}</h2>
          <p className="text-sm font-medium mb-1 text-white">This page is private</p>
          <p className="text-xs mb-6" style={{ color: "#94a3b8" }}>
            {message || "Enter the access code to continue."}
          </p>

          {attempts >= 5 ? (
            <p className="text-sm font-medium text-amber-500">Too many attempts. Please try again later.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Input
                  type={showCode ? "text" : "password"}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
                  placeholder="Enter access code"
                  className={`text-center uppercase tracking-[0.15em] font-mono text-lg h-12 pr-10 ${shake ? "animate-shake" : ""} ${error ? "border-red-500" : ""}`}
                  style={{ background: "#09090b", borderColor: error ? "#ef4444" : "#27272a", color: "#fff" }}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCode ? "Hide code" : "Show code"}
                >
                  {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <Button
                type="submit"
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                disabled={loading || !code.trim()}
              >
                {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Verifying...</> : "Continue →"}
              </Button>
            </form>
          )}

          <p className="text-[10px] mt-4 flex items-center justify-center gap-1" style={{ color: "#94a3b8" }}>
            <Lock size={10} /> Secure & encrypted verification
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};
