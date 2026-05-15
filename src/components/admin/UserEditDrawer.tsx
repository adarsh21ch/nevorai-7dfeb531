import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { planName } from "@/config/planDisplay";

interface Props {
  open: boolean;
  onClose: () => void;
  user: any | null;
  subscription: any | null;
}

const PLAN_OPTIONS = ["free", "basic", "pro"];

export const UserEditDrawer = ({ open, onClose, user, subscription }: Props) => {
  const qc = useQueryClient();
  const [tier, setTier] = useState<string>("free");
  const [monthly, setMonthly] = useState<string>("");
  const [daily, setDaily] = useState<string>("");
  const [funnels, setFunnels] = useState<string>("");
  const [extra, setExtra] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setTier(subscription?.tier || subscription?.plan_key || "free");
    setMonthly(user.custom_monthly_views_limit == null ? "" : String(user.custom_monthly_views_limit));
    setDaily(user.custom_daily_views_limit == null ? "" : String(user.custom_daily_views_limit));
    setFunnels(user.custom_max_funnels == null ? "" : String(user.custom_max_funnels));
    setExtra(user.extra_views_purchased == null ? "" : String(user.extra_views_purchased));
  }, [open, user, subscription]);

  const parseNullable = (v: string): number | null => {
    if (v === "") return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update profile overrides
      const profileUpdate: any = {
        custom_monthly_views_limit: parseNullable(monthly),
        custom_daily_views_limit: parseNullable(daily),
        custom_max_funnels: parseNullable(funnels),
      };
      const extraNum = parseNullable(extra);
      if (extraNum != null) {
        profileUpdate.extra_views_purchased = extraNum;
        // Set expiry to end of current month so the boost lasts only this billing period
        const eom = new Date();
        eom.setMonth(eom.getMonth() + 1, 1);
        eom.setHours(0, 0, 0, 0);
        profileUpdate.extra_views_expires_at = eom.toISOString();
      }
      const { error: pErr } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);
      if (pErr) throw pErr;

      // Update subscription tier (active row)
      if (subscription?.user_id) {
        const { error: sErr } = await supabase
          .from("user_subscriptions")
          .update({ tier, plan_key: tier } as any)
          .eq("user_id", user.id)
          .eq("status", "active");
        if (sErr) throw sErr;
      } else {
        await supabase
          .from("user_subscriptions")
          .insert({ user_id: user.id, tier, plan_key: tier, status: "active", billing_type: "manual" } as any);
      }

      // Audit log
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) {
        await supabase.rpc("log_admin_action", {
          _admin_user_id: auth.user.id,
          _action: "edit_user",
          _target_type: "user",
          _target_id: user.id,
          _metadata: { tier, monthly, daily, flows } as any,
        });
      }

      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-all-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-all-subs"] });
      qc.invalidateQueries({ queryKey: ["admin-monthly-views"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1.5">
          <SheetTitle>Edit user</SheetTitle>
          <SheetDescription className="text-xs">
            {user?.full_name || "—"} · {user?.email}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Plan</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{planName(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Updates the user's active subscription tier.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Monthly views override</Label>
            <Input
              value={monthly}
              onChange={(e) => setMonthly(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="empty = use plan"
            />
            <p className="text-[10px] text-muted-foreground">Empty = plan default · -1 = unlimited</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Daily views override</Label>
            <Input
              value={daily}
              onChange={(e) => setDaily(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="empty = use plan"
            />
            <p className="text-[10px] text-muted-foreground">Empty = plan default · -1 = unlimited</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Max flows override</Label>
            <Input
              value={flows}
              onChange={(e) => setFunnels(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="empty = use plan"
            />
            <p className="text-[10px] text-muted-foreground">Empty = plan default · -1 = unlimited</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Extra views (top-up)</Label>
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
            <p className="text-[10px] text-muted-foreground">
              Bonus views on top of plan; expires at end of current month.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
