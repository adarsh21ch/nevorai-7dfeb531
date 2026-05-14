import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";

const companies = ["Forever Living", "Amway", "Herbalife", "Modicare", "Vestige", "Mi Lifestyle", "Other"];
const teamSizes = ["Just me", "2-10", "10-50", "50-200", "200+"];
const sources = ["Instagram", "YouTube", "WhatsApp", "Friend / Referral", "Google Search", "Facebook", "Other"];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({ company: "", teamSize: "", source: "" });
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from("profiles").update({
        company: data.company,
        team_size: data.teamSize,
        onboarding_completed: true,
        onboarding_data: { company: data.company, team_size: data.teamSize, source: data.source },
      }).eq("id", user.id);
      await refreshProfile();
      toast.success("Welcome to nFlow by Nevorai!");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const canNext = step === 1 ? !!data.company : step === 2 ? !!data.teamSize : !!data.source;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3">Let's personalize your experience — Step {step} of 3</p>
          <div className="flex gap-2 justify-center mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? "gradient-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <div className="glass-card p-8">
          {step === 1 && (
            <div className="space-y-4">
              <Label className="text-base font-heading font-semibold">What company or brand are you with?</Label>
              <div className="grid grid-cols-2 gap-3">
                {companies.map((c) => (
                  <button key={c} onClick={() => setData({ ...data, company: c })}
                    className={`p-3 rounded-lg border text-sm text-left transition-all ${data.company === c ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30"}`}>
                    <div className="flex items-center justify-between">
                      {c}
                      {data.company === c && <Check size={16} className="text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label className="text-base font-heading font-semibold">What is your team size?</Label>
              <div className="grid grid-cols-1 gap-3">
                {teamSizes.map((s) => (
                  <button key={s} onClick={() => setData({ ...data, teamSize: s })}
                    className={`p-3 rounded-lg border text-sm text-left transition-all ${data.teamSize === s ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30"}`}>
                    <div className="flex items-center justify-between">
                      {s}
                      {data.teamSize === s && <Check size={16} className="text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Label className="text-base font-heading font-semibold">How did you hear about nFlow by Nevorai?</Label>
              <div className="grid grid-cols-2 gap-3">
                {sources.map((s) => (
                  <button key={s} onClick={() => setData({ ...data, source: s })}
                    className={`p-3 rounded-lg border text-sm text-left transition-all ${data.source === s ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted text-muted-foreground hover:border-muted-foreground/30"}`}>
                    <div className="flex items-center justify-between">
                      {s}
                      {data.source === s && <Check size={16} className="text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>
            )}
            {step < 3 ? (
              <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canNext} className="flex-1">Continue</Button>
            ) : (
              <Button variant="hero" onClick={handleComplete} disabled={!canNext || loading} className="flex-1">
                {loading ? "Setting up..." : "Get Started"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
