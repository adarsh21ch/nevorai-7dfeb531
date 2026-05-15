import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Global on/off switch for the blue "verified creator" badge.
 * Stored in app_settings(key='verified_badge_enabled', value='true'|'false').
 * When OFF, no verified badges show on any public video page even if a
 * profile has is_verified = true.
 */
export const VerifiedBadgeToggle = () => {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(true);

  const { data } = useQuery({
    queryKey: ["app-setting", "verified_badge_enabled"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", "verified_badge_enabled")
        .maybeSingle();
      if (!data) return true;
      return data.value === "true" || data.value === true;
    },
  });

  useEffect(() => {
    if (typeof data === "boolean") setEnabled(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert({ key: "verified_badge_enabled", value: String(next) }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verified-badge setting updated");
      qc.invalidateQueries({ queryKey: ["app-setting", "verified_badge_enabled"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  return (
    <div className="glass-card p-3 sm:p-6 space-y-3">
      <h2 className="text-sm font-heading font-semibold flex items-center gap-2 sm:text-base">
        <BadgeCheck size={16} className="text-primary" /> Verified Creators
      </h2>
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <div className="flex-1 min-w-0">
          <Label className="text-xs sm:text-sm">Enable verified badges globally</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5 sm:text-xs">
            When off, no blue ✓ shows on any public video page — even for users marked verified.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            save.mutate(v);
          }}
        />
      </div>
    </div>
  );
};
