import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { Save, Target, BarChart3, MessageSquare, Video, FileText, Users, TrendingUp, Shield, Zap, Upload, Eye, Layers, Bell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TrialSettingsStrip } from "@/components/admin/TrialSettingsStrip";
import { adminWrite } from "@/lib/adminWrite";

const ViewTiersManager = lazy(() => import("@/components/admin/ViewTiersManager").then((m) => ({ default: m.ViewTiersManager })));
const fallback = <div className="glass-card p-4 text-sm text-muted-foreground">Loading…</div>;

const PlanField = ({ planName, field, label, type = "number", disabled = false, hint, value: initialValue, onSave }: {
  planName: string; field: string; label: string; type?: string; disabled?: boolean; hint?: string;
  value: any; onSave: (planName: string, field: string, value: any) => Promise<void>;
}) => {
  const [localValue, setLocalValue] = useState<string>(String(initialValue ?? ""));
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!isDirty) setLocalValue(String(initialValue ?? "")); }, [initialValue, isDirty]);

  const handleSave = async () => {
    setSaving(true);
    const parsed = type === "text" ? localValue : (localValue === "" ? null : parseInt(localValue));
    await onSave(planName, field, parsed);
    setIsDirty(false);
    setSaving(false);
  };

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 min-w-0">
          <Label className="text-xs font-medium">{label}</Label>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
        <Switch checked={!!initialValue} disabled={disabled} onCheckedChange={(v) => onSave(planName, field, v)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input ref={inputRef} type={type === "text" ? "text" : "number"} value={localValue} disabled={disabled}
          className="w-16 sm:w-24 h-8 text-xs" placeholder={type === "text" ? "" : "-1=∞"}
          onChange={(e) => { setLocalValue(e.target.value); setIsDirty(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />
        {isDirty && (
          <Button size="sm" className="h-8 gap-1 text-xs px-2" onClick={handleSave} disabled={saving}>
            <Save size={12} />
          </Button>
        )}
      </div>
    </div>
  );
};

const StorageFieldGB = ({ planName, mbValue, disabled, onSave }: {
  planName: string; mbValue: number | null | undefined; disabled?: boolean;
  onSave: (planName: string, field: string, value: any) => Promise<void>;
}) => {
  const mbToGb = (mb: number | null | undefined): string => {
    if (mb == null) return "";
    if (mb === -1) return "-1";
    if (mb === 0) return "0";
    return String(mb / 1024);
  };

  const [localValue, setLocalValue] = useState<string>(mbToGb(mbValue));
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isDirty) setLocalValue(mbToGb(mbValue)); }, [mbValue, isDirty]);

  const handleSave = async () => {
    setSaving(true);
    let mb: number | null;
    if (localValue === "") mb = null;
    else {
      const gb = parseFloat(localValue);
      if (isNaN(gb)) mb = null;
      else if (gb === -1) mb = -1;
      else mb = Math.round(gb * 1024);
    }
    await onSave(planName, "max_storage_mb", mb);
    setIsDirty(false);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2 py-2">
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">Max Storage (GB)</Label>
        <p className="text-[10px] text-muted-foreground">e.g. 0.5 = 500 MB · -1 = unlimited</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input type="number" step="0.1" value={localValue} disabled={disabled}
          className="w-16 sm:w-24 h-8 text-xs" placeholder="-1=∞"
          onChange={(e) => { setLocalValue(e.target.value); setIsDirty(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />
        {isDirty && (
          <Button size="sm" className="h-8 gap-1 text-xs px-2" onClick={handleSave} disabled={saving}>
            <Save size={12} />
          </Button>
        )}
      </div>
    </div>
  );
};

const FEATURE_GROUPS = [
  { group: "Content", items: [
    { field: "feature_funnel_creation", label: "Funnel Creation", icon: Layers },
    { field: "feature_video_upload", label: "Video Upload", icon: Upload },
    { field: "feature_youtube_import", label: "YouTube Video Import", icon: Video },
    { field: "feature_video_sharing", label: "Video Sharing", icon: Video },
    { field: "feature_landing_pages", label: "Landing Pages", icon: FileText },
    { field: "feature_custom_branding", label: "Custom Branding", icon: Sparkles },
  ]},
  { group: "Lead Generation", items: [
    { field: "feature_lead_capture", label: "Lead Capture", icon: Target },
    { field: "feature_custom_form_fields", label: "Custom Form Fields", icon: FileText },
    { field: "feature_whatsapp_automation", label: "WhatsApp Auto-Message", icon: MessageSquare },
    { field: "feature_smart_reminders", label: "Smart Follow-up Reminders", icon: Bell },
  ]},
  { group: "Engagement", items: [
    { field: "feature_go_live", label: "Live Broadcast", icon: Video },
    { field: "multilevel_funnel_enabled", label: "Multi-Step Funnels", icon: TrendingUp },
    { field: "feature_analytics", label: "Analytics Dashboard", icon: BarChart3 },
    { field: "feature_advanced_analytics", label: "Advanced Analytics", icon: Zap },
    { field: "feature_prospect_analytics", label: "Per-Prospect Watch Analytics", icon: Eye },
    { field: "feature_insights", label: "Insights Dashboard", icon: Eye },
  ]},
  { group: "Team", items: [
    { field: "feature_team_analytics", label: "Team Dashboard", icon: Users },
    { field: "feature_priority_support", label: "Priority Support", icon: Shield },
  ]},
];

const PLAN_META: Record<string, { label: string; badge: string; desc: string }> = {
  free: { label: "Free", badge: "bg-muted text-muted-foreground", desc: "Forever free · entry tier" },
  basic: { label: "Basic", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", desc: "For Individuals" },
  pro: { label: "Pro", badge: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400", desc: "For Team Leaders" },
};

const AdminPlansPage = () => {
  const queryClient = useQueryClient();
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "basic" | "pro">("all");

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["admin-plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as any[];
    },
  });

  const saveField = useCallback(async (planName: string, field: string, value: any) => {
    const derivedMonthlyViews =
      field === "daily_view_limit" && typeof value === "number"
        ? (value === -1 ? -1 : value * 30)
        : null;

    const updateObj: Record<string, any> = { [field]: value, updated_at: new Date().toISOString() };
    if (field === "daily_view_limit") updateObj.monthly_views = derivedMonthlyViews;

    const { error } = await adminWrite(() =>
      (supabase.from("plan_config") as any).update(updateObj).eq("plan_name", planName).select(),
    );

    if (!error && field === "daily_view_limit" && (planName === "basic" || planName === "pro") && typeof value === "number") {
      const { data: baseTier } = await (supabase.from("plan_view_tiers" as any) as any)
        .select("id").eq("plan_name", planName).eq("is_base", true)
        .order("display_order", { ascending: true }).limit(1).maybeSingle();
      if (baseTier?.id) {
        await adminWrite(() =>
          (supabase.from("plan_view_tiers" as any) as any)
            .update({ daily_views: value, monthly_views: derivedMonthlyViews, updated_at: new Date().toISOString() } as any)
            .eq("id", baseTier.id).select(),
        );
      }
    }

    if (error) toast.error(error.message || "Failed to save");
    else {
      toast.success("Updated!");
      ["admin-plan-configs","plan-configs","plan-pricing","plan-configs-landing","billing-tier-plans","admin-monthly-views","plan-view-tiers","plan-view-tiers-public","user-plan","plan-config"]
        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    }
  }, [queryClient]);

  const handleTogglePlan = async (planName: string, enabled: boolean) => {
    const { error } = await adminWrite(() =>
      (supabase.from("plan_config") as any)
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("plan_name", planName).select(),
    );
    if (error) toast.error(error.message || "Failed to update");
    else {
      toast.success(`${planName} plan ${enabled ? "enabled" : "disabled"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-plan-configs"] });
      queryClient.invalidateQueries({ queryKey: ["plan-configs"] });
    }
  };

  const freeConfig = planConfigs.find(c => c.plan_name === "free");
  const basicConfig = planConfigs.find(c => c.plan_name === "basic");
  const proConfig = planConfigs.find(c => c.plan_name === "pro");

  const renderPlanCard = (planName: string, config: any) => {
    const meta = PLAN_META[planName];
    if (!meta) return null;
    const isDisabled = config?.is_enabled === false;

    return (
      <div className={`glass-card p-3 sm:p-4 space-y-3 transition-opacity ${isDisabled ? "opacity-50" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold sm:text-xs sm:px-2 ${meta.badge}`}>{meta.label}</span>
            <span className="text-[10px] text-muted-foreground sm:text-xs truncate">{meta.desc}</span>
          </div>
          <Switch checked={!isDisabled} onCheckedChange={(v) => handleTogglePlan(planName, v)} />
        </div>

        <Tabs defaultValue="pricing" className="w-full">
          <TabsList className="w-full grid h-8 grid-cols-3">
            <TabsTrigger value="pricing" className="text-[10px] sm:text-xs">Pricing</TabsTrigger>
            <TabsTrigger value="limits" className="text-[10px] sm:text-xs">Limits</TabsTrigger>
            <TabsTrigger value="features" className="text-[10px] sm:text-xs">Features</TabsTrigger>
          </TabsList>

          <TabsContent value="pricing" className="pt-2 space-y-2">
            {(planName === "basic" || planName === "pro") ? (
              <Suspense fallback={fallback}>
                <ViewTiersManager planName={planName as "basic" | "pro"} />
              </Suspense>
            ) : (
              <p className="text-[11px] text-muted-foreground italic px-1">No pricing fields for this plan.</p>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-3">General</p>
            <div className="flex items-center justify-between gap-2 px-1 py-1.5 rounded-md bg-muted/30">
              <div className="flex flex-col">
                <span className="text-xs font-medium">Monthly Validity</span>
                <span className="text-[10px] text-muted-foreground">Fixed at 30 days per billing cycle</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">30</span>
            </div>
            <PlanField planName={planName} field="yearly_validity_days" label="Yearly Validity (days)" hint="Default 365." value={config?.yearly_validity_days} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="plan_badge_text" label="Badge Text" type="text" value={config?.plan_badge_text || ""} onSave={saveField} disabled={isDisabled} hint="Shown on pricing page" />
          </TabsContent>

          <TabsContent value="limits" className="pt-2 space-y-0.5">
            <PlanField planName={planName} field="daily_view_limit" label="Daily Views / Day" hint="-1 = unlimited" value={config?.daily_view_limit} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="max_funnels" label="Max Funnels" hint="-1 = unlimited · 0 = disabled" value={config?.max_funnels} onSave={saveField} disabled={isDisabled} />
            <StorageFieldGB planName={planName} mbValue={config?.max_storage_mb} disabled={isDisabled} onSave={saveField} />
            <PlanField planName={planName} field="max_landing_pages" label="Max Landing Pages" hint="-1 = unlimited · 0 = disabled" value={config?.max_landing_pages} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="max_live_sessions" label="Max Live Sessions" hint="-1 = unlimited · 0 = disabled" value={config?.max_live_sessions} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="max_leads" label="Max Leads Stored" hint="-1 = unlimited" value={config?.max_leads} onSave={saveField} disabled={isDisabled} />
          </TabsContent>

          <TabsContent value="features" className="pt-2 space-y-2">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.group} className="space-y-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">{group.group}</p>
                {group.items.map(({ field, label, icon: Icon }) => (
                  <div key={field} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                    <Icon size={13} className="text-muted-foreground shrink-0" />
                    <p className="flex-1 min-w-0 text-[11px] font-medium sm:text-xs truncate">{label}</p>
                    <Switch checked={!!config?.[field]} disabled={isDisabled} onCheckedChange={(v) => saveField(planName, field, v)} />
                  </div>
                ))}
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {isDisabled && (
          <p className="text-[10px] text-amber-500 bg-amber-500/10 rounded-lg p-2 sm:text-xs sm:p-3">
            ⚠️ {meta.label} plan is disabled. It won't appear on pricing page.
          </p>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-heading font-bold sm:text-2xl">Plans & Features</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Edit limits, features, and pricing for each plan. Changes apply instantly across the app.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            {(["all", "free", "basic", "pro"] as const).map((k) => (
              <button key={k} onClick={() => setPlanFilter(k)}
                className={`px-3 py-1 rounded-md transition-colors capitalize ${
                  planFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {k === "all" ? "All Plans" : k}
              </button>
            ))}
          </div>
        </div>

        <div className={`grid gap-3 ${planFilter === "all" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
          {(planFilter === "all" || planFilter === "free") && renderPlanCard("free", freeConfig)}
          {(planFilter === "all" || planFilter === "basic") && renderPlanCard("basic", basicConfig)}
          {(planFilter === "all" || planFilter === "pro") && renderPlanCard("pro", proConfig)}
        </div>

        <p className="text-[11px] text-muted-foreground italic mt-2">
          Enterprise plan is managed separately in Subscriptions → Enterprise.
        </p>

        <TrialSettingsStrip />
      </div>
    </AdminLayout>
  );
};

export default AdminPlansPage;
