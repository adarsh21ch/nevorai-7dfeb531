import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/adminWrite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Star, Save, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";

interface Tier {
  id: string;
  plan_name: string;
  daily_views: number;
  monthly_views: number;
  monthly_price: number;
  yearly_price: number;
  is_active: boolean;
  is_popular: boolean;
  is_base: boolean;
  display_order: number;
}

const compact = (n: number) => n.toLocaleString("en-IN");

const EditableNumberCell = ({
  value, prefix = "", onSave,
}: { value: number; prefix?: string; onSave: (n: number) => Promise<void> }) => {
  const [v, setV] = useState(String(value ?? ""));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!dirty) setV(String(value ?? "")); }, [value, dirty]);
  const save = async () => {
    setSaving(true);
    await onSave(parseInt(v) || 0);
    setDirty(false);
    setSaving(false);
  };
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-muted-foreground text-xs">{prefix}</span>}
      <NumberInput
        min={0}
        value={v === "" ? "" : Number(v)}
        onValueChange={(n) => { setV(n === "" ? "" : String(n)); setDirty(true); }}
        onBlur={() => dirty && save()}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        className="h-7 w-20 text-xs px-2"
      />
      {saving && <Loader2 size={10} className="animate-spin" />}
    </div>
  );
};

export const ViewTiersManager = ({ planName }: { planName: string }) => {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [newTier, setNewTier] = useState({
    daily_views: "", monthly_price: "", yearly_price: "", is_popular: false,
  });

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["plan-view-tiers", planName],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_tiers" as any)
        .select("*")
        .eq("plan_name", planName)
        .order("display_order");
      return (data || []) as unknown as Tier[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["plan-view-tiers", planName] });

  const updateTier = async (id: string, patch: Partial<Tier>) => {
    const { error } = await adminWrite(() =>
      (supabase.from("plan_tiers" as any) as any).update(patch as any).eq("id", id).select(),
    );
    if (error) toast.error(error.message);
    else { toast.success("Updated"); refresh(); qc.invalidateQueries({ queryKey: ["plan-pricing"] }); qc.invalidateQueries({ queryKey: ["plans"] }); }
  };

  const setPopular = async (id: string, val: boolean) => {
    if (val) {
      await adminWrite(() =>
        (supabase.from("plan_tiers" as any) as any)
          .update({ is_popular: false } as any).eq("plan_name", planName).select(),
        { expectRows: false },
      );
    }
    await updateTier(id, { is_popular: val });
  };

  const setBase = async (id: string, val: boolean) => {
    if (val) {
      await adminWrite(() =>
        (supabase.from("plan_tiers" as any) as any)
          .update({ is_base: false } as any).eq("plan_name", planName).select(),
        { expectRows: false },
      );
    }
    await updateTier(id, { is_base: val });
  };

  const deleteTier = async (id: string) => {
    if (!(await confirm({ title: "Delete this tier?", description: "Users on this tier will fall back to the popular tier.", confirmLabel: "Delete", destructive: true }))) return;
    const { error } = await adminWrite(() =>
      (supabase.from("plan_tiers" as any) as any).delete().eq("id", id).select(),
    );
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); refresh(); qc.invalidateQueries({ queryKey: ["plan-pricing"] }); qc.invalidateQueries({ queryKey: ["plans"] }); }
  };

  const saveNewTier = async () => {
    const dv = parseInt(newTier.daily_views);
    const mp = parseInt(newTier.monthly_price);
    const yp = parseInt(newTier.yearly_price);
    if (!dv || !mp || !yp) {
      toast.error("All numeric fields required");
      return;
    }
    const { error } = await adminWrite(() =>
      (supabase.from("plan_tiers" as any) as any).insert({
        plan_name: planName,
        daily_views: dv,
        monthly_price: mp,
        yearly_price: yp,
        is_popular: newTier.is_popular,
        display_order: tiers.length + 1,
      } as any).select(),
    );
    if (error) { toast.error(error.message); return; }
    toast.success("Tier added");
    if (newTier.is_popular) {
      await adminWrite(() =>
        (supabase.from("plan_tiers" as any) as any)
          .update({ is_popular: false } as any)
          .eq("plan_name", planName)
          .neq("display_order", tiers.length + 1)
          .select(),
        { expectRows: false },
      );
    }
    setNewTier({ daily_views: "", monthly_price: "", yearly_price: "", is_popular: false });
    setAdding(false);
    refresh();
    qc.invalidateQueries({ queryKey: ["plan-pricing"] }); qc.invalidateQueries({ queryKey: ["plans"] });
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Star size={12} className="text-primary" /> View Limit Tiers
          </h4>
          <p className="text-[10px] text-muted-foreground">
            Users pick a tier when subscribing. Monthly = daily × 30 (auto).
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setAdding(v => !v)}>
          <Plus size={12} /> Add
        </Button>
      </div>

      {isLoading ? (
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 font-medium">Daily</th>
                <th className="text-left py-1.5 font-medium">Monthly</th>
                <th className="text-left py-1.5 font-medium">₹/mo</th>
                <th className="text-left py-1.5 font-medium">₹/yr</th>
                <th className="text-center py-1.5 font-medium">Base</th>
                <th className="text-center py-1.5 font-medium">Pop</th>
                <th className="text-center py-1.5 font-medium">On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => (
                <tr key={t.id} className="border-b border-border/30">
                  <td className="py-1.5">
                    <EditableNumberCell value={t.daily_views} onSave={(v) => updateTier(t.id, { daily_views: v })} />
                  </td>
                  <td className="py-1.5 text-muted-foreground">{compact(t.daily_views * 30)}</td>
                  <td className="py-1.5">
                    <EditableNumberCell value={t.monthly_price} prefix="₹" onSave={(v) => updateTier(t.id, { monthly_price: v })} />
                  </td>
                  <td className="py-1.5">
                    <EditableNumberCell value={t.yearly_price} prefix="₹" onSave={(v) => updateTier(t.id, { yearly_price: v })} />
                  </td>
                  <td className="py-1.5 text-center">
                    <input type="checkbox" checked={!!t.is_base} onChange={(e) => setBase(t.id, e.target.checked)} title="Base tier — assigned to new subscribers" />
                  </td>
                  <td className="py-1.5 text-center">
                    <input type="checkbox" checked={t.is_popular} onChange={(e) => setPopular(t.id, e.target.checked)} />
                  </td>
                  <td className="py-1.5 text-center">
                    <Switch checked={t.is_active} onCheckedChange={(v) => updateTier(t.id, { is_active: v })} />
                  </td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => deleteTier(t.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={8} className="text-center py-3 text-muted-foreground">No tiers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <Label className="text-[10px]">Daily views</Label>
              <NumberInput min={1} max={1000000} value={newTier.daily_views === "" ? "" : Number(newTier.daily_views)} onValueChange={(n) => setNewTier(p => ({ ...p, daily_views: n === "" ? "" : String(n) }))} className="h-7 text-xs" placeholder="50" />
            </div>
            <div>
              <Label className="text-[10px]">Monthly ₹</Label>
              <NumberInput min={0} prefix="₹" value={newTier.monthly_price === "" ? "" : Number(newTier.monthly_price)} onValueChange={(n) => setNewTier(p => ({ ...p, monthly_price: n === "" ? "" : String(n) }))} className="h-7 text-xs" placeholder="249" />
            </div>
            <div>
              <Label className="text-[10px]">Yearly ₹</Label>
              <NumberInput min={0} prefix="₹" value={newTier.yearly_price === "" ? "" : Number(newTier.yearly_price)} onValueChange={(n) => setNewTier(p => ({ ...p, yearly_price: n === "" ? "" : String(n) }))} className="h-7 text-xs" placeholder="2490" />
            </div>
          </div>
          {newTier.daily_views && (
            <p className="text-[10px] text-muted-foreground">
              = {compact((parseInt(newTier.daily_views) || 0) * 30)} views/month
            </p>
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[11px]">
              <input type="checkbox" checked={newTier.is_popular} onChange={e => setNewTier(p => ({ ...p, is_popular: e.target.checked }))} />
              Mark as Popular
            </label>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-[11px] gap-1" onClick={saveNewTier}><Save size={11} />Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
