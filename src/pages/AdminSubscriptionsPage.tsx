import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { Search, Crown, Ban, CheckCircle2, XCircle, Save, Target, BarChart3, MessageSquare, Video, FileText, Users, TrendingUp, Shield, Zap, Upload, Eye, Layers, Bell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { PlanConfig } from "@/hooks/usePlanLimits";
import { EnterpriseCardSettings } from "@/components/admin/EnterpriseCardSettings";
import { TrialSettingsStrip } from "@/components/admin/TrialSettingsStrip";
import { AdminOverrideAuditTable } from "@/components/admin/AdminOverrideAuditTable";
import { adminWrite } from "@/lib/adminWrite";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const ViewTiersManager = lazy(() => import("@/components/admin/ViewTiersManager").then((m) => ({ default: m.ViewTiersManager })));
const RefundsTab = lazy(() => import("@/components/admin/RefundsTab").then((m) => ({ default: m.RefundsTab })));
const MemberGatewayTab = lazy(() => import("@/components/admin/MemberGatewayTab").then((m) => ({ default: m.MemberGatewayTab })));
const EnterpriseInquiriesTab = lazy(() => import("@/components/admin/EnterpriseInquiriesTab").then((m) => ({ default: m.EnterpriseInquiriesTab })));

const adminTabFallback = <div className="glass-card p-4 text-sm text-muted-foreground">Loading…</div>;


const PlanField = ({ planName, field, label, type = "number", disabled = false, hint, value: initialValue, onSave }: {
  planName: string; field: string; label: string; type?: string; disabled?: boolean; hint?: string;
  value: any; onSave: (planName: string, field: string, value: any) => Promise<void>;
}) => {
  const [localValue, setLocalValue] = useState<string>(String(initialValue ?? ""));
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDirty) setLocalValue(String(initialValue ?? ""));
  }, [initialValue, isDirty]);

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

/**
 * Storage field shown in GB to admins. Internally stored as MB in DB.
 * 0.5 GB = 512 MB, 1 GB = 1024 MB, -1 = unlimited.
 */
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

  useEffect(() => {
    if (!isDirty) setLocalValue(mbToGb(mbValue));
  }, [mbValue, isDirty]);

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
        <Input
          type="number"
          step="0.1"
          value={localValue}
          disabled={disabled}
          className="w-16 sm:w-24 h-8 text-xs"
          placeholder="-1=∞"
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

// Grouped feature toggles shown under each plan card → Features tab.
const FEATURE_GROUPS: { group: string; items: { field: string; label: string; icon: any }[] }[] = [
  {
    group: "Content",
    items: [
      { field: "feature_funnel_creation", label: "Funnel Creation", icon: Layers },
      { field: "feature_video_upload", label: "Video Upload", icon: Upload },
      { field: "feature_youtube_import", label: "YouTube Video Import", icon: Video },
      { field: "feature_video_sharing", label: "Video Sharing", icon: Video },
      { field: "feature_landing_pages", label: "Landing Pages", icon: FileText },
      { field: "feature_custom_branding", label: "Custom Branding", icon: Sparkles },
    ],
  },
  {
    group: "Lead Generation",
    items: [
      { field: "feature_lead_capture", label: "Lead Capture", icon: Target },
      { field: "feature_whatsapp_automation", label: "WhatsApp Auto-Message", icon: MessageSquare },
      { field: "feature_smart_reminders", label: "Smart Follow-up Reminders", icon: Bell },
    ],
  },
  {
    group: "Engagement",
    items: [
      { field: "feature_go_live", label: "Live Broadcast", icon: Video },
      { field: "multilevel_funnel_enabled", label: "Multi-Step Funnels", icon: TrendingUp },
      { field: "feature_analytics", label: "Analytics Dashboard", icon: BarChart3 },
      { field: "feature_advanced_analytics", label: "Advanced Analytics", icon: Zap },
      { field: "feature_prospect_analytics", label: "Per-Prospect Watch Analytics", icon: Eye },
      { field: "feature_insights", label: "Insights Dashboard", icon: Eye },
    ],
  },
  {
    group: "Team",
    items: [
      { field: "feature_team_analytics", label: "Team Dashboard", icon: Users },
      { field: "feature_priority_support", label: "Priority Support", icon: Shield },
    ],
  },
];

const AdminSubscriptionsPage = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const queryClient = useQueryClient();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["admin-all-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data || [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["admin-plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as any[];
    },
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      return data || [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const filtered = subscriptions.filter((s) => {
    if (!debouncedSearch) return true;
    const profile = profileMap[s.user_id];
    const q = debouncedSearch.toLowerCase();
    return profile?.full_name?.toLowerCase().includes(q) ||
      profile?.email?.toLowerCase().includes(q) ||
      s.plan_key.toLowerCase().includes(q);
  });

  // Revenue: only count actually paid subs (active or cancelled but had a paid period),
  // exclude free/manual/replaced rows that have amount_paid = 0 or null.
  const totalRevenue = subscriptions
    .filter((s) => s.billing_type !== "free" && s.billing_type !== "manual" && s.billing_type !== "nevorai_member")
    .reduce((a, s) => a + (s.amount_paid || 0), 0);
  const activeCount = subscriptions.filter((s) => s.status === "active" && s.tier !== "free").length;
  const basicCount = subscriptions.filter((s) => s.status === "active" && s.tier === "basic").length;
  const proCount = subscriptions.filter((s) => s.status === "active" && s.tier === "pro").length;
  const freeCount = subscriptions.filter((s) => s.status === "active" && s.tier === "free").length;
  const failedCount = subscriptions.filter((s) => s.status === "payment_failed").length;

  const handleManualGrant = async (userId: string, tier: string) => {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 86400000);
    await supabase.from("user_subscriptions").update({ status: "replaced" }).eq("user_id", userId).eq("status", "active");
    const planKey = tier === "basic" ? "basic_monthly" : "pro_monthly";
    const { error } = await supabase.from("user_subscriptions").insert({
      user_id: userId, plan_key: planKey, tier, status: "active",
      billing_type: "manual", amount_paid: 0,
      started_at: now.toISOString(), expires_at: expires.toISOString(),
    });
    if (error) toast.error(error.message);
    else { toast.success(`${tier} access granted`); queryClient.invalidateQueries({ queryKey: ["admin-all-subscriptions"] }); }
  };

  const handleRevoke = async (subId: string) => {
    const { error } = await supabase.from("user_subscriptions").update({ status: "cancelled" }).eq("id", subId);
    if (error) toast.error(error.message);
    else { toast.success("Access revoked"); queryClient.invalidateQueries({ queryKey: ["admin-all-subscriptions"] }); }
  };

  const saveField = useCallback(async (planName: string, field: string, value: any) => {
    const updateObj: Record<string, any> = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await adminWrite(() =>
      (supabase.from("plan_config") as any)
        .update(updateObj)
        .eq("plan_name", planName)
        .select(),
    );
    if (error) {
      toast.error(error.message || "Failed to save");
    } else {
      toast.success("Updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-plan-configs"] });
      queryClient.invalidateQueries({ queryKey: ["plan-configs"] });
      queryClient.invalidateQueries({ queryKey: ["plan-pricing"] });
    }
  }, [queryClient]);

  const handleTogglePlan = async (planName: string, enabled: boolean) => {
    const { error } = await adminWrite(() =>
      (supabase.from("plan_config") as any)
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("plan_name", planName)
        .select(),
    );
    if (error) toast.error(error.message || "Failed to update");
    else {
      toast.success(`${planName.charAt(0).toUpperCase() + planName.slice(1)} plan ${enabled ? "enabled" : "disabled"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-plan-configs"] });
      queryClient.invalidateQueries({ queryKey: ["plan-configs"] });
    }
  };

  const basicConfig = planConfigs.find(c => c.plan_name === "basic") as any;
  const proConfig = planConfigs.find(c => c.plan_name === "pro") as any;
  const enterpriseConfig = planConfigs.find(c => c.plan_name === "enterprise") as any;

  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});

  const handleSettingSave = async (key: string) => {
    const val = editingSettings[key];
    if (val === undefined) return;
    const { error } = await supabase.from("platform_settings").update({ value: val }).eq("key", key);
    if (error) toast.error(error.message);
    else { toast.success("Setting updated"); queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] }); }
  };

  const getSettingValue = (key: string) => settings.find(s => s.key === key)?.value || "";

  const PLAN_META: Record<string, { label: string; badge: string; desc: string }> = {
    free: { label: "Free", badge: "bg-muted text-muted-foreground", desc: "Forever free · entry tier" },
    basic: { label: "Basic", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", desc: "For Individuals" },
    pro: { label: "Pro", badge: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400", desc: "For Team Leaders" },
    enterprise: { label: "Enterprise", badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400", desc: "For Large Networks" },
  };

  const freeConfig = planConfigs.find(c => c.plan_name === "free") as any;
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "basic" | "pro">("all");

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
               <Suspense fallback={adminTabFallback}>
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
            <PlanField planName={planName} field="yearly_validity_days" label="Yearly Validity (days)" hint="How long a yearly subscription lasts before renewal. Default 365." value={config?.yearly_validity_days} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="plan_badge_text" label="Badge Text" type="text" value={config?.plan_badge_text || ""} onSave={saveField} disabled={isDisabled} hint="Shown on pricing page" />
          </TabsContent>

          <TabsContent value="limits" className="pt-2 space-y-0.5">
            <PlanField planName={planName} field="daily_view_limit" label="Daily Views / Day" hint="-1 = unlimited. Shown on pricing page & enforced per funnel." value={config?.daily_view_limit} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="max_funnels" label="Max Funnels" hint="-1 = unlimited" value={config?.max_funnels} onSave={saveField} disabled={isDisabled} />
            <StorageFieldGB planName={planName} mbValue={config?.max_storage_mb} disabled={isDisabled} onSave={saveField} />
            <PlanField planName={planName} field="max_landing_pages" label="Max Landing Pages" hint="-1 = unlimited" value={config?.max_landing_pages} onSave={saveField} disabled={isDisabled} />
            <PlanField planName={planName} field="max_live_sessions" label="Max Live Sessions" hint="-1 = unlimited" value={config?.max_live_sessions} onSave={saveField} disabled={isDisabled} />
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
        <h1 className="text-lg font-heading font-bold sm:text-2xl">Subscriptions & Billing</h1>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-6 sm:gap-3">
          {[
            { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, color: "" },
            { label: "Paid", value: activeCount, color: "text-primary" },
            { label: "Free", value: freeCount, color: "text-muted-foreground" },
            { label: "Basic", value: basicCount, color: "text-primary" },
            { label: "Pro", value: proCount, color: "text-success" },
            { label: "Failed", value: failedCount, color: "text-destructive" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-2.5 sm:p-4">
              <p className="text-[10px] text-muted-foreground mb-0.5 sm:text-xs sm:mb-1">{stat.label}</p>
              <p className={`text-base font-heading font-bold sm:text-2xl ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="subscriptions">
          <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7 h-9">
            <TabsTrigger value="subscriptions" className="text-[10px] sm:text-sm">Subs</TabsTrigger>
            <TabsTrigger value="plans" className="text-[10px] sm:text-sm">Plans</TabsTrigger>
            <TabsTrigger value="refunds" className="text-[10px] sm:text-sm">Refunds</TabsTrigger>
            <TabsTrigger value="gateway" className="text-[10px] sm:text-sm">Gateway</TabsTrigger>
            <TabsTrigger value="enterprise" className="text-[10px] sm:text-sm">Enterprise</TabsTrigger>
            <TabsTrigger value="audit" className="text-[10px] sm:text-sm">Audit</TabsTrigger>
            <TabsTrigger value="settings" className="text-[10px] sm:text-sm">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-3 pt-1">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search user, plan..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-4 text-xs text-muted-foreground font-medium">User</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Plan</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Status</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Amount</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Expires</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const profile = profileMap[s.user_id];
                      return (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                          <td className="p-4">
                            <p className="font-medium">{profile?.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{profile?.email}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              s.tier === "pro" ? "bg-green-500/10 text-green-600" :
                              s.tier === "basic" ? "bg-blue-500/10 text-blue-600" :
                              "bg-muted text-muted-foreground"
                            }`}>{s.tier}</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs inline-flex items-center gap-1 ${
                              s.status === "active" ? "bg-green-500/10 text-green-600" :
                              s.status === "payment_failed" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {s.status === "active" ? <CheckCircle2 size={10} /> : s.status === "payment_failed" ? <XCircle size={10} /> : null}
                              {s.status}
                            </span>
                          </td>
                          <td className="p-4">₹{(s.amount_paid || 0).toLocaleString("en-IN")}</td>
                          <td className="p-4 text-xs text-muted-foreground">
                            {s.expires_at ? new Date(s.expires_at).toLocaleDateString("en-IN") : "—"}
                          </td>
                          <td className="p-4 space-x-1">
                            {s.status === "active" && s.tier !== "free" && (
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleRevoke(s.id)}>
                                <Ban size={12} /> Revoke
                              </Button>
                            )}
                            {(s.status !== "active" || s.tier === "free") && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleManualGrant(s.user_id, "basic")}>
                                  Basic
                                </Button>
                                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleManualGrant(s.user_id, "pro")}>
                                  <Crown size={12} /> Pro
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {filtered.map((s) => {
                const profile = profileMap[s.user_id];
                return (
                  <div key={s.id} className="glass-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{profile?.full_name || "—"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          s.tier === "pro" ? "bg-green-500/10 text-green-600" :
                          s.tier === "basic" ? "bg-blue-500/10 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        }`}>{s.tier}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          s.status === "active" ? "bg-green-500/10 text-green-600" :
                          s.status === "payment_failed" ? "bg-destructive/10 text-destructive" :
                          "bg-muted text-muted-foreground"
                        }`}>{s.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <div className="text-[11px] text-muted-foreground">
                        ₹{(s.amount_paid || 0).toLocaleString("en-IN")} · {s.expires_at ? new Date(s.expires_at).toLocaleDateString("en-IN") : "—"}
                      </div>
                      <div className="flex gap-1">
                        {s.status === "active" && s.tier !== "free" && (
                          <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => handleRevoke(s.id)}>
                            <Ban size={10} />
                          </Button>
                        )}
                        {(s.status !== "active" || s.tier === "free") && (
                          <>
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => handleManualGrant(s.user_id, "basic")}>Basic</Button>
                            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2" onClick={() => handleManualGrant(s.user_id, "pro")}>Pro</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="plans" className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Edit any field — changes save automatically. Choose a plan below to focus, or view all side-by-side.
              </p>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                {(["all", "free", "basic", "pro"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setPlanFilter(k)}
                    className={`px-3 py-1 rounded-md transition-colors capitalize ${
                      planFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
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
              Enterprise plan is managed separately in the Enterprise tab.
            </p>
            <TrialSettingsStrip />
          </TabsContent>

          <TabsContent value="refunds" className="space-y-3 pt-1">
            <Suspense fallback={adminTabFallback}>
              <RefundsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="gateway" className="space-y-3 pt-1">
            <Suspense fallback={adminTabFallback}>
              <MemberGatewayTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="enterprise" className="space-y-3 pt-1">
            <Tabs defaultValue="inquiries" className="space-y-3">
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
                <TabsTrigger value="inquiries" className="text-xs sm:text-sm">Inquiries</TabsTrigger>
                <TabsTrigger value="card" className="text-xs sm:text-sm">Card Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="inquiries" className="space-y-3 pt-1">
                <Suspense fallback={adminTabFallback}>
                  <EnterpriseInquiriesTab />
                </Suspense>
              </TabsContent>
              <TabsContent value="card" className="space-y-3 pt-1">
                <EnterpriseCardSettings />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="audit" className="space-y-3 pt-1">
            <AdminOverrideAuditTable />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground pt-4">Payment events</h3>
            {/* Desktop audit table */}
            <div className="hidden sm:block glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-4 text-xs text-muted-foreground font-medium">User</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Event</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Source</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Razorpay ID</th>
                      <th className="p-4 text-xs text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      const profile = profileMap[log.user_id || ""];
                      return (
                        <tr key={log.id} className="border-b border-border/50">
                          <td className="p-4 text-xs">{profile?.full_name || log.user_id || "—"}</td>
                          <td className="p-4 text-xs">{log.event_type}</td>
                          <td className="p-4 text-xs">{log.source}</td>
                          <td className="p-4 text-xs font-mono">{log.razorpay_payment_id || log.razorpay_order_id || "—"}</td>
                          <td className="p-4 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No audit logs yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Mobile audit cards */}
            <div className="sm:hidden space-y-2">
              {auditLogs.length === 0 ? (
                <div className="glass-card p-8 text-center text-sm text-muted-foreground">No audit logs yet</div>
              ) : auditLogs.map((log) => {
                const profile = profileMap[log.user_id || ""];
                return (
                  <div key={log.id} className="glass-card p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{profile?.full_name || "Unknown"}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleDateString("en-IN")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.event_type} · {log.source}</p>
                    {(log.razorpay_payment_id || log.razorpay_order_id) && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{log.razorpay_payment_id || log.razorpay_order_id}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3 pt-1">
            <div className="glass-card p-3 sm:p-5 space-y-3 w-full min-w-0">
              <h3 className="text-sm font-heading font-semibold">Platform Settings</h3>
              {["razorpay_key_id", "maintenance_mode", "whatsapp_support_number"].map(key => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs font-medium capitalize">{key.replace(/_/g, " ")}</Label>
                    <Input className="mt-1 h-8 text-xs" value={editingSettings[key] ?? getSettingValue(key)}
                      onChange={e => setEditingSettings(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                  <Button size="sm" className="h-8 mt-5 px-2" onClick={() => handleSettingSave(key)}>
                    <Save size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptionsPage;
