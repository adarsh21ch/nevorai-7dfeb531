import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Clock, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [3, 7, 14, 30];

export const TrialSettingsStrip = () => {
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

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 mt-4">
      {/* Label */}
      <div className="flex items-center gap-2 min-w-[110px]">
        <Clock size={15} className="text-primary" />
        <span className="text-sm font-semibold">Free Trial</span>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2 flex-1 min-w-[260px]">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Duration</span>
        <input
          type="number"
          min={1}
          max={90}
          value={days}
          disabled={!enabled}
          onChange={(e) => setDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
          className="w-14 h-8 text-center rounded-md bg-muted border border-border text-sm font-semibold disabled:opacity-30"
        />
        <span className="text-[11px] text-muted-foreground">days</span>
        <div className="flex gap-1.5 ml-1">
          {PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              disabled={!enabled}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                days === d
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              } disabled:opacity-25`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="ml-auto px-5 h-9 rounded-lg text-xs font-semibold bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-colors flex items-center gap-2 disabled:opacity-60"
      >
        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving</> : savedAt ? <><Check size={13} /> Saved</> : "Save"}
      </button>
    </div>
  );
};
