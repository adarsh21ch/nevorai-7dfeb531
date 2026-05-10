import { useEffect, useState } from "react";
import { format, addDays } from "date-fns";
import { Crown, Infinity as InfinityIcon, Eye, MoreVertical, Lock, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlanPricing, type ViewTier } from "@/hooks/usePlanPricing";

type AnyUser = any;

interface Props {
  user: AnyUser;
  subscription: any | null;
  onEdit?: () => void;
}

const refreshKeys = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["admin-all-profiles"] });
  qc.invalidateQueries({ queryKey: ["admin-all-subs"] });
  qc.invalidateQueries({ queryKey: ["admin-monthly-views"] });
  qc.invalidateQueries({ queryKey: ["admin-override-audit"] });
};

const logAudit = async (action: string, targetId: string, metadata: any, note: string) => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) return;
  await supabase.rpc("log_admin_action", {
    _admin_user_id: auth.user.id,
    _action: action,
    _target_type: "user",
    _target_id: targetId,
    _metadata: { ...metadata, note } as any,
  });
};

/* ───────────── Grant Unlimited ───────────── */
const GrantUnlimitedModal = ({ user, open, onClose }: { user: AnyUser; open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setNote(""); }, [open]);

  const submit = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          is_unlimited: true,
          override_granted_by: auth?.user?.id ?? null,
          override_granted_at: new Date().toISOString(),
          override_note: note,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      await logAudit("grant_unlimited", user.id, { previous_plan: user.plan_key }, note);
      toast.success(`Unlimited access granted to ${user.email}`);
      refreshKeys(qc);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to grant unlimited");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><InfinityIcon size={18} className="text-purple-400" /> Grant Unlimited Access</DialogTitle>
          <DialogDescription className="text-xs">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs">
          <p className="font-medium text-purple-300 mb-2">This removes ALL limits for this user:</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>✓ Unlimited daily views (no prospect blocks)</li>
            <li>✓ Unlimited funnels, storage, landing pages</li>
            <li>✓ Unlimited live sessions and leads</li>
          </ul>
          <p className="mt-2 text-[11px] text-purple-300/70">Badge will show "∞ Unlimited". Revoke any time.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reason / Note (internal, required)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Partner account, Demo user, Compensation..." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!note.trim() || busy} className="bg-purple-500 hover:bg-purple-600 text-white">
            {busy ? "Granting..." : "Grant Unlimited"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────── Grant Plan ───────────── */
const GrantPlanModal = ({ user, subscription, open, onClose }: { user: AnyUser; subscription: any | null; open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const { pricing } = usePlanPricing();
  const [plan, setPlan] = useState<"basic" | "pro">("basic");
  const [tier, setTier] = useState<ViewTier | null>(null);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const tiers = (plan === "basic" ? pricing.basic.tiers : pricing.pro.tiers) ?? [];

  useEffect(() => {
    if (!open) return;
    setPlan("basic"); setDays(30); setNote("");
  }, [open]);

  useEffect(() => {
    const base = tiers.find((t) => t.is_base) ?? tiers[0] ?? null;
    setTier(base);
  }, [plan, tiers.length]);

  const expiry = addDays(new Date(), days);

  const submit = async () => {
    if (!tier || !note.trim()) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const expiresAtIso = expiry.toISOString();

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          subscription_status: "active",
          selected_daily_views: tier.daily_views,
          selected_tier_id: tier.id,
          override_granted_by: auth?.user?.id ?? null,
          override_granted_at: new Date().toISOString(),
          override_note: note,
        } as any)
        .eq("id", user.id);
      if (pErr) throw pErr;

      // Upsert subscription
      if (subscription?.id) {
        await supabase
          .from("user_subscriptions")
          .update({ plan_key: plan, tier: plan, status: "active", expires_at: expiresAtIso, billing_type: "admin_grant" } as any)
          .eq("id", subscription.id);
      } else {
        await supabase
          .from("user_subscriptions")
          .insert({ user_id: user.id, plan_key: plan, tier: plan, status: "active", expires_at: expiresAtIso, billing_type: "admin_grant" } as any);
      }

      await logAudit("grant_plan", user.id, {
        plan, tier_id: tier.id, daily_views: tier.daily_views,
        duration_days: days, expires_at: expiresAtIso,
        previous_plan: subscription?.plan_key ?? subscription?.tier ?? "free",
      }, note);

      toast.success(`${plan === "pro" ? "Pro" : "Basic"} plan granted to ${user.email}`);
      refreshKeys(qc);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to grant plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crown size={18} className="text-amber-400" /> Grant Plan Manually</DialogTitle>
          <DialogDescription className="text-xs">
            {user.email} · Current: {subscription?.plan_key ?? subscription?.tier ?? "free"} · {subscription?.status ?? user.subscription_status ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs">Plan</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["basic", "pro"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  plan === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:border-border/80"
                }`}
              >
                {p === "basic" ? "Basic" : "Pro"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">View Tier</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tiers.length === 0 ? (
              <p className="col-span-full text-xs text-muted-foreground">No tiers available.</p>
            ) : tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => setTier(t)}
                className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                  tier?.id === t.id ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-border/80"
                }`}
              >
                <div className="font-semibold">{t.daily_views}/day</div>
                <div className="text-[10px] text-muted-foreground">₹{t.monthly_price}/mo</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Duration (days)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number" min={1} max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 h-9"
            />
            <div className="flex gap-1">
              {[7, 30, 90, 365].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {d}d
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">Expires {format(expiry, "dd MMM yyyy")}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Reason (required — shown in audit log)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment failed but verified, Compensation..." />
        </div>

        {tier && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><strong>{plan === "pro" ? "Pro" : "Basic"}</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Daily views</span><strong>{tier.daily_views}/day</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valid for</span><strong>{days} days</strong></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><strong>None — admin grant</strong></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!tier || !note.trim() || busy}>
            {busy ? "Granting..." : `Grant ${plan === "pro" ? "Pro" : "Basic"} Plan →`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────── Set View Override ───────────── */
const SetViewOverrideModal = ({ user, open, onClose }: { user: AnyUser; open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const initial = user.custom_daily_views_limit ?? user.selected_daily_views ?? 20;
  const [limit, setLimit] = useState<number>(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setLimit(user.custom_daily_views_limit ?? user.selected_daily_views ?? 20);
      setNote("");
    }
  }, [open, user]);

  const apply = async (newLimit: number | null, reason: string) => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("profiles")
        .update({
          custom_daily_views_limit: newLimit,
          override_granted_by: newLimit == null ? null : auth?.user?.id ?? null,
          override_granted_at: newLimit == null ? null : new Date().toISOString(),
          override_note: newLimit == null ? null : reason,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      await logAudit("grant_tier_override", user.id, { custom_daily_views_limit: newLimit }, reason);
      toast.success(newLimit == null ? "Override removed" : `Daily limit set to ${newLimit === -1 ? "∞" : newLimit}`);
      refreshKeys(qc);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to set override");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye size={18} /> Set View Limit Override</DialogTitle>
          <DialogDescription className="text-xs">
            Override this user's daily view limit without changing their plan. Set to -1 for unlimited.
          </DialogDescription>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">
          Current plan: {user.plan_key ?? "—"} · Selected: {user.selected_daily_views ?? "default"}/day
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs">Custom daily view limit (-1 = unlimited)</Label>
          <Input type="number" min={-1} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          <div className="flex flex-wrap gap-1 pt-1">
            {[-1, 50, 100, 200, 500, 1000].map((v) => (
              <button key={v} onClick={() => setLimit(v)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${limit === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {v === -1 ? "∞" : `${v}/d`}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Reason (required)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Campaign boost, Testing, Compensation..." />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {user.custom_daily_views_limit != null && (
            <Button variant="destructive" onClick={() => apply(null, note || "Removed override")} disabled={busy}>
              Remove Override
            </Button>
          )}
          <Button onClick={() => apply(limit, note)} disabled={!note.trim() || busy}>Set Override →</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───────────── Badge ───────────── */
export const AdminUserOverrideBadge = ({ user, plan }: { user: AnyUser; plan: { name: string; badgeClass: string } }) => {
  if (user?.is_unlimited) {
    return (
      <span className="inline-flex flex-col items-start rounded-lg border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-bold text-purple-300 leading-tight">
        <span className="flex items-center gap-1"><InfinityIcon size={11} /> Unlimited</span>
      </span>
    );
  }
  if (user?.override_granted_at) {
    return (
      <span className="inline-flex flex-col items-start rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 leading-tight">
        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-200"><Crown size={10} /> {plan.name}</span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-amber-200/70">Admin Grant</span>
      </span>
    );
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${plan.badgeClass}`}>{plan.name}</span>;
};

/* ───────────── Menu trigger ───────────── */
export const AdminOverrideMenu = ({ user, subscription, onEdit }: Props) => {
  const qc = useQueryClient();
  const [unlimitedOpen, setUnlimitedOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const revokeUnlimited = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_unlimited: false,
          override_granted_by: null,
          override_granted_at: null,
          override_note: null,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      await logAudit("revoke_unlimited", user.id, {}, "Admin revoked unlimited access");
      toast.success("Unlimited access revoked");
      refreshKeys(qc);
    } catch (e: any) {
      toast.error(e.message || "Failed to revoke");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busy}>
            <MoreVertical size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={13} className="mr-2" /> Edit user
            </DropdownMenuItem>
          )}
          {user?.is_unlimited ? (
            <DropdownMenuItem onClick={revokeUnlimited} className="text-destructive focus:text-destructive">
              <Lock size={13} className="mr-2" /> Revoke Unlimited Access
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setUnlimitedOpen(true)} className="text-purple-400 focus:text-purple-400">
              <InfinityIcon size={13} className="mr-2" /> Grant Unlimited Access
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setPlanOpen(true)}>
            <Crown size={13} className="mr-2" /> Grant Plan Manually
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOverrideOpen(true)}>
            <Eye size={13} className="mr-2" /> Set View Limit Override
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-[11px] text-muted-foreground">
            All actions are audit-logged
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {unlimitedOpen && <GrantUnlimitedModal user={user} open={unlimitedOpen} onClose={() => setUnlimitedOpen(false)} />}
      {planOpen && <GrantPlanModal user={user} subscription={subscription} open={planOpen} onClose={() => setPlanOpen(false)} />}
      {overrideOpen && <SetViewOverrideModal user={user} open={overrideOpen} onClose={() => setOverrideOpen(false)} />}
    </>
  );
};
