import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Layers, Video, BarChart3, IndianRupee, Shield } from "lucide-react";
import { MemberGatewayDashboardCard } from "@/components/admin/MemberGatewayDashboardCard";
import { ViewsAnalyticsCard } from "@/components/admin/ViewsAnalyticsCard";
import { formatCompact, formatINR, formatInt } from "@/lib/format";

const AdminDashboard = () => {
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, created_at, kyc_status");
      return data || [];
    },
  });

  const { data: flows = [] } = useQuery({
    queryKey: ["admin-flows-count"],
    queryFn: async () => {
      const { data } = await supabase.from("funnels").select("id, total_views, total_leads, total_payments");
      return data || [];
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["admin-videos-count"],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("id");
      return data || [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("amount_paid, tier, status");
      return data || [];
    },
  });

  const { data: kycPending = [] } = useQuery({
    queryKey: ["admin-kyc-pending"],
    queryFn: async () => {
      const { data } = await supabase.from("user_kyc_submissions").select("id").eq("status", "pending");
      return data || [];
    },
  });

  const mrr = subs.filter((s) => s.status === "active" && s.tier !== "free").reduce((a, s) => a + (s.amount_paid || 0), 0);
  const totalViews = flows.reduce((a, f) => a + ((f as any).total_views || 0), 0);
  const totalLeads = flows.reduce((a, f) => a + ((f as any).total_leads || 0), 0);

  const kpis = [
    { icon: Users, label: "Total Users", value: formatInt(profiles.length) },
    { icon: Layers, label: "Total Flows", value: formatInt(flows.length) },
    { icon: Video, label: "Total Videos", value: formatInt(videos.length) },
    { icon: BarChart3, label: "Total Views", value: formatCompact(totalViews) },
    { icon: Users, label: "Total Leads", value: formatCompact(totalLeads) },
    { icon: IndianRupee, label: "Revenue", value: formatINR(mrr) },
    { icon: Shield, label: "KYC Pending", value: formatInt(kycPending.length) },
  ];

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4">
        <div>
          <h1 className="text-lg font-heading font-bold sm:text-2xl">Admin Dashboard</h1>
          <div className="page-header-accent" />
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">Platform overview and management.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="glass-card min-w-0 p-3 sm:p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <k.icon size={15} className="text-primary" />
                </div>
                <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{k.label}</p>
              </div>
              <p className="mt-3 truncate text-xl font-heading font-bold sm:text-2xl">{k.value}</p>
            </div>
          ))}
          <MemberGatewayDashboardCard />
        </div>

        <ViewsAnalyticsCard />
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
