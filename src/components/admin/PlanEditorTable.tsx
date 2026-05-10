import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Check, X } from "lucide-react";
import {
  PLAN_FEATURES,
  PLAN_KEYS_ORDER,
  PLAN_LABELS,
  type PlanFeature,
  type PlanKey,
} from "@/config/planFeatures";

type Row = Record<string, any>;

const dbToUi = (feature: PlanFeature, dbValue: any) => {
  if (feature.type === "number" && "fromDb" in feature && feature.fromDb) {
    return feature.fromDb(dbValue);
  }
  return dbValue;
};

const uiToDb = (feature: PlanFeature, uiValue: any) => {
  if (feature.type === "number" && "toDb" in feature && feature.toDb) {
    return feature.toDb(uiValue);
  }
  return uiValue;
};

export const PlanEditorTable = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<PlanKey, Row>>({} as Record<PlanKey, Row>);
  const [savingPlan, setSavingPlan] = useState<PlanKey | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as Row[];
    },
  });

  // Hydrate draft once plans load
  useEffect(() => {
    if (!plans.length) return;
    const next: Record<string, Row> = {};
    for (const p of plans) {
      if (PLAN_KEYS_ORDER.includes(p.plan_name as PlanKey)) {
        next[p.plan_name] = { ...p };
      }
    }
    setDraft(next as Record<PlanKey, Row>);
  }, [plans]);

  const original = useMemo(() => {
    const map: Record<string, Row> = {};
    for (const p of plans) map[p.plan_name] = p;
    return map;
  }, [plans]);

  const isDirty = (plan: PlanKey): boolean => {
    const o = original[plan];
    const d = draft[plan];
    if (!o || !d) return false;
    return PLAN_FEATURES.some((f) => {
      const oVal = o[f.dbField];
      const dVal = d[f.dbField];
      if (oVal == null && (dVal == null || dVal === "")) return false;
      return String(oVal) !== String(dVal);
    });
  };

  const updateCell = (plan: PlanKey, feature: PlanFeature, value: any) => {
    setDraft((prev) => ({
      ...prev,
      [plan]: { ...(prev[plan] || {}), [feature.dbField]: value },
    }));
  };

  const savePlan = async (plan: PlanKey) => {
    const d = draft[plan];
    if (!d) return;
    setSavingPlan(plan);
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const f of PLAN_FEATURES) {
      if (f.hideFor?.includes(plan)) continue;
      const raw = d[f.dbField];
      let value: any = raw;
      if (f.type === "number") {
        if (raw === "" || raw == null) value = null;
        else value = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (Number.isNaN(value)) value = null;
        value = uiToDb(f, value);
      } else if (f.type === "boolean") {
        value = !!raw;
      } else {
        value = raw ?? "";
      }
      update[f.dbField] = value;
    }
    const { error } = await supabase
      .from("plan_config")
      .update(update as any)
      .eq("plan_name", plan);
    setSavingPlan(null);
    if (error) {
      toast.error(`Failed to save ${PLAN_LABELS[plan]}: ${error.message}`);
      return;
    }
    toast.success(`${PLAN_LABELS[plan]} plan updated`);
    queryClient.invalidateQueries({ queryKey: ["admin-plan-configs"] });
    queryClient.invalidateQueries({ queryKey: ["plan-configs"] });
    queryClient.invalidateQueries({ queryKey: ["plan-configs-landing"] });
    queryClient.invalidateQueries({ queryKey: ["user-plan"] });
    queryClient.invalidateQueries({ queryKey: ["plan-config"] });
  };

  const saveAll = async () => {
    for (const plan of PLAN_KEYS_ORDER) {
      if (isDirty(plan)) await savePlan(plan);
    }
  };

  const dirtyCount = PLAN_KEYS_ORDER.filter(isDirty).length;

  if (!plans.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories: Array<PlanFeature["category"]> = ["Limits", "Features", "Pricing"];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Edit any cell — changes are queued per plan. Click <strong>Save</strong> on a column or
          <strong> Save All Changes</strong> to apply.
        </p>
        <Button
          onClick={saveAll}
          disabled={!dirtyCount || !!savingPlan}
          size="sm"
          variant="hero"
          className="gap-1.5"
        >
          {savingPlan ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save All Changes{dirtyCount ? ` (${dirtyCount})` : ""}
        </Button>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/40 z-10 min-w-[200px]">
                Feature / Limit
              </th>
              {PLAN_KEYS_ORDER.map((plan) => (
                <th key={plan} className="px-3 py-3 text-xs font-semibold min-w-[140px]">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        plan === "pro"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : plan === "basic"
                          ? "bg-indigo-500/15 text-indigo-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {PLAN_LABELS[plan]}
                    </span>
                    {isDirty(plan) && (
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => savePlan(plan)}
                        disabled={savingPlan === plan}
                      >
                        {savingPlan === plan ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Save size={10} />
                        )}
                        Save
                      </Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const rows = PLAN_FEATURES.filter((f) => f.category === category);
              if (!rows.length) return null;
              return (
                <>
                  <tr key={`cat-${category}`} className="bg-primary/5">
                    <td
                      colSpan={1 + PLAN_KEYS_ORDER.length}
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary sticky left-0"
                    >
                      {category}
                    </td>
                  </tr>
                  {rows.map((feature) => (
                    <tr key={feature.key} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2 sticky left-0 bg-card z-10">
                        <div className="font-medium text-xs sm:text-sm">{feature.label}</div>
                        {feature.hint && (
                          <div className="text-[10px] text-muted-foreground">{feature.hint}</div>
                        )}
                      </td>
                      {PLAN_KEYS_ORDER.map((plan) => {
                        if (feature.hideFor?.includes(plan)) {
                          return (
                            <td key={plan} className="px-3 py-2 text-center text-muted-foreground/50 text-xs">
                              —
                            </td>
                          );
                        }
                        const dbVal = draft[plan]?.[feature.dbField];
                        const uiVal =
                          feature.type === "number" ? dbToUi(feature, dbVal) : dbVal;

                        if (feature.type === "boolean") {
                          return (
                            <td key={plan} className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Switch
                                  checked={!!uiVal}
                                  onCheckedChange={(v) => updateCell(plan, feature, v)}
                                />
                                {!!uiVal ? (
                                  <Check size={12} className="text-green-500" />
                                ) : (
                                  <X size={12} className="text-muted-foreground/40" />
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (feature.type === "select") {
                          return (
                            <td key={plan} className="px-3 py-2">
                              <select
                                value={uiVal ?? feature.options[0]?.value}
                                onChange={(e) => updateCell(plan, feature, e.target.value)}
                                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              >
                                {feature.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        return (
                          <td key={plan} className="px-3 py-2">
                            <Input
                              type={feature.type === "number" ? "number" : "text"}
                              step={feature.type === "number" ? (feature as any).step ?? 1 : undefined}
                              value={uiVal ?? ""}
                              placeholder={feature.type === "number" ? "-1=∞" : ""}
                              className="h-8 text-xs text-center"
                              onChange={(e) =>
                                updateCell(
                                  plan,
                                  feature,
                                  feature.type === "number"
                                    ? e.target.value === ""
                                      ? null
                                      : parseFloat(e.target.value)
                                    : e.target.value,
                                )
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip: enter <code className="px-1 py-0.5 rounded bg-muted">-1</code> for unlimited on any
        numeric limit.
      </p>
    </div>
  );
};
