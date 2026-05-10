import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

interface StepCodeGateProps {
  funnelId: string;
  stepId: string;
  stepTitle: string;
  message?: string;
  sessionId: string;
  onSuccess: () => void;
  isDark?: boolean;
}

/**
 * Per-step access code gate. Renders inside the video area of MultiStepViewer
 * when funnel_steps.access_code_enabled is true.
 */
export const StepCodeGate = ({
  funnelId,
  stepId,
  stepTitle,
  message,
  sessionId,
  onSuccess,
  isDark = true,
}: StepCodeGateProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const sc = {
    bg: isDark ? "#09090b" : "#f1f5f9",
    cardBg: isDark ? "#141419" : "#ffffff",
    border: isDark ? "#27272a" : "#e5e7eb",
    text: isDark ? "#ffffff" : "#0f172a",
    textMuted: isDark ? "#94a3b8" : "#64748b",
    inputBg: isDark ? "#09090b" : "#f8fafc",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading || attempts >= 5) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-step-access-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            funnel_id: funnelId,
            step_id: stepId,
            code: code.trim(),
            session_id: sessionId,
          }),
        },
      );

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        try {
          localStorage.setItem(`nf_step_code_${stepId}_${sessionId}`, "true");
        } catch {}
        setTimeout(() => onSuccess(), 800);
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

  if (success) {
    return (
      <div
        className="aspect-video rounded-2xl flex items-center justify-center animate-in fade-in"
        style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
      >
        <div className="text-center">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-primary" />
          <p className="font-bold text-lg" style={{ color: sc.text }}>
            Unlocked!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="aspect-video rounded-2xl flex items-center justify-center p-6"
      style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
    >
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
          <Lock size={24} className="text-primary" />
        </div>

        <div>
          <h3 className="text-lg font-bold" style={{ color: sc.text }}>
            {stepTitle ? `${stepTitle} is locked` : "This step is locked"}
          </h3>
          <p
            className="text-sm mt-2 leading-relaxed"
            style={{ color: sc.textMuted }}
          >
            {message || "Enter the access code shared with you to unlock this step."}
          </p>
        </div>

        {attempts >= 5 ? (
          <p className="text-sm font-medium text-amber-500">
            Too many attempts. Please try again in 15 minutes.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Input
                type={showCode ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
                placeholder="Enter code"
                className={`text-center uppercase tracking-[0.12em] font-mono text-base h-12 pr-10 ${
                  shake ? "animate-shake" : ""
                } ${error ? "border-red-500" : ""}`}
                style={{
                  background: sc.inputBg,
                  borderColor: error ? "#ef4444" : sc.border,
                  color: sc.text,
                }}
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: sc.textMuted }}
                aria-label={showCode ? "Hide code" : "Show code"}
              >
                {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <Button
              type="submit"
              className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={loading || !code.trim()}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" /> Verifying...
                </>
              ) : (
                "Unlock Step →"
              )}
            </Button>
          </form>
        )}
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
