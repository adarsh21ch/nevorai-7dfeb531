import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [3, 7, 14, 30];

export const TrialSettingsCard = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["app-settings-trial-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings" as any)
        .select("key, value")
        .in("key", ["trial_enabled", "trial_days"]);
      return data || [];
    },
  });

  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    (data as any[] | undefined)?.forEach((s: any) => {
      if (s.key === "trial_enabled") setEnabled(s.value === "true");
      if (s.key === "trial_days") setDays(parseInt(s.value, 10) || 7);
    });
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings" as any).upsert(
      [
        { key: "trial_enabled", value: String(enabled) },
        { key: "trial_days", value: String(days) },
      ],
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) {
      toast.error("Failed to save trial settings");
      return;
    }
    setSavedAt(Date.now());
    qc.invalidateQueries({ queryKey: ["app-settings-trial"] });
    qc.invalidateQueries({ queryKey: ["app-settings-trial-admin"] });
    qc.invalidateQueries({ queryKey: ["app-settings-trial-public"] });
    toast.success("Trial settings saved");
    setTimeout(() => setSavedAt(0), 2500);
  };

  const ctaPreview = enabled
    ? `Start ${days}-Day Free Trial — No Card Needed`
    : "Get Started";

  return (
    <div className="glass-card p-3 sm:p-6 space-y-4">
      <div>
        <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
          <Clock size={16} className="text-primary" /> Trial Settings
        </h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 sm:text-xs">
          Control the free trial period for new signups. Changes apply immediately — no code change needed.
        </p>
      </div>

      <div className="flex items-start justify-between gap-3 min-h-[44px] border-t border-border pt-4">
        <div className="flex-1 min-w-0">
          <Label className="text-xs sm:text-sm">Enable Free Trial</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5 sm:text-xs">
            When off, new users must choose a plan immediately after signup.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <Label className="text-xs sm:text-sm">Trial Duration (days)</Label>
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          How many days a new user gets before they must upgrade.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) =>
              setDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))
            }
            className="w-20 text-center bg-muted border-border"
            disabled={!enabled}
          />
          <span className="text-xs text-muted-foreground">days</span>
          <div className="flex gap-1.5 ml-1">
            {PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                disabled={!enabled}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  days === d
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted border-border text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 mt-2">
          <p className="text-[11px] text-muted-foreground">
            Preview CTA: <span className="text-foreground font-medium">"{ctaPreview}"</span>
          </p>
        </div>
      </div>

      <Button
        variant="hero"
        className="w-full min-h-[44px] text-sm"
        onClick={save}
        disabled={saving}
      >
        {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : savedAt ? <><Check size={14} /> Saved</> : "Save Trial Settings"}
      </Button>
    </div>
  );
};
