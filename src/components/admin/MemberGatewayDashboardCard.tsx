import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemberGatewaySettings } from "@/hooks/useMemberGatewaySettings";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const MemberGatewayDashboardCard = () => {
  const { settings } = useMemberGatewaySettings();

  const { data: stats } = useQuery({
    queryKey: ["gateway-dashboard-stats"],
    queryFn: async () => {
      const [{ count: active }, { count: pendingNotif }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("nevorai_member_active", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("nevorai_member", true)
          .eq("nevorai_member_notified", false),
      ]);
      return { active: active ?? 0, pendingNotif: pendingNotif ?? 0 };
    },
    staleTime: 30_000,
  });

  const runCheck = async () => {
    const t = toast.loading("Running gateway check…");
    const { data, error } = await supabase.functions.invoke("nevorai-gateway-check", { body: {} });
    toast.dismiss(t);
    if (error) {
      toast.error(error.message);
      return;
    }
    const summary = (data as any)?.summary;
    toast.success(
      summary
        ? `Done — ${summary.granted} granted, ${summary.expired} expired`
        : "Check complete",
    );
  };

  if (!settings) return null;

  const durationLabel =
    settings.access_duration_type === "continuous"
      ? "Continuous"
      : settings.access_duration_type === "days"
        ? `${settings.access_duration_days ?? 0} days`
        : "Disabled";

  return (
    <div className="glass-card min-w-0 p-3 sm:p-5 col-span-2 lg:col-span-2">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles size={15} className="text-primary" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Member Gateway</p>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            settings.gateway_enabled
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {settings.gateway_enabled ? "ACTIVE" : "DISABLED"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <p className="text-muted-foreground text-[10px]">Duration</p>
          <p className="font-semibold">{durationLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Active</p>
          <p className="font-semibold">{stats?.active ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Pending notify</p>
          <p className="font-semibold">{stats?.pendingNotif ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px]">Last check</p>
          <p className="font-semibold text-[11px]">
            {settings.last_check_at
              ? new Date(settings.last_check_at).toLocaleDateString("en-IN")
              : "Never"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="text-[11px] h-7 flex-1" onClick={runCheck}>
          Run check now
        </Button>
        <Link to="/admin/subscriptions" className="flex-1">
          <Button size="sm" className="text-[11px] h-7 w-full gap-1">
            Manage <ArrowRight size={10} />
          </Button>
        </Link>
      </div>
    </div>
  );
};
