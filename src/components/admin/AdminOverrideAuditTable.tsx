import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Crown, Infinity as InfinityIcon, Lock, Eye } from "lucide-react";

const ACTIONS = ["grant_unlimited", "revoke_unlimited", "grant_plan", "grant_tier_override"] as const;

const actionLabel = (a: string) => {
  switch (a) {
    case "grant_unlimited":     return { icon: <InfinityIcon size={11} />, label: "Unlimited granted",   cls: "text-purple-300 bg-purple-500/10" };
    case "revoke_unlimited":    return { icon: <Lock size={11} />,         label: "Unlimited revoked",    cls: "text-rose-300 bg-rose-500/10" };
    case "grant_plan":          return { icon: <Crown size={11} />,        label: "Plan granted",         cls: "text-amber-200 bg-amber-500/10" };
    case "grant_tier_override": return { icon: <Eye size={11} />,          label: "View override set",    cls: "text-sky-300 bg-sky-500/10" };
    default:                    return { icon: null,                       label: a,                      cls: "text-muted-foreground bg-muted" };
  }
};

const formatDetails = (m: any) => {
  if (!m || typeof m !== "object") return "";
  const parts: string[] = [];
  if (m.plan) parts.push(`plan=${m.plan}`);
  if (m.daily_views) parts.push(`${m.daily_views}/day`);
  if (m.duration_days) parts.push(`${m.duration_days}d`);
  if (m.custom_daily_views_limit !== undefined) {
    parts.push(`limit=${m.custom_daily_views_limit === -1 ? "∞" : m.custom_daily_views_limit ?? "removed"}`);
  }
  return parts.join(" · ");
};

export const AdminOverrideAuditTable = () => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-override-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .in("action", ACTIONS as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    staleTime: 15_000,
  });

  // Resolve target user emails
  const targetIds = Array.from(new Set(logs.map((l: any) => l.target_id).filter(Boolean)));
  const { data: targets = [] } = useQuery({
    queryKey: ["admin-override-audit-targets", targetIds.sort().join(",")],
    queryFn: async () => {
      if (!targetIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, email").in("id", targetIds);
      return data || [];
    },
    enabled: targetIds.length > 0,
  });
  const targetMap = Object.fromEntries(targets.map((t: any) => [t.id, t.email]));

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Admin overrides</h3>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-xs text-muted-foreground font-medium">Time</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Admin</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">User</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Action</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Details</th>
                <th className="p-3 text-xs text-muted-foreground font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-xs">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-xs">No override actions yet</td></tr>
              ) : logs.map((log: any) => {
                const a = actionLabel(log.action);
                const note = log.metadata?.note ?? "";
                return (
                  <tr key={log.id} className="border-b border-border/50">
                    <td className="p-3 text-[11px] text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "dd MMM, HH:mm")}</td>
                    <td className="p-3 text-xs">{log.admin_email || "—"}</td>
                    <td className="p-3 text-xs">{targetMap[log.target_id] || log.target_id?.slice(0, 8)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.cls}`}>
                        {a.icon} {a.label}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground">{formatDetails(log.metadata)}</td>
                    <td className="p-3 text-[11px] text-muted-foreground max-w-xs truncate" title={note}>{note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
