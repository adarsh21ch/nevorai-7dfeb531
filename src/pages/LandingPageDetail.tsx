import { useState } from "react";
import { useParams } from "@/lib/router-compat";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Eye, Users, Mail, Download, Search, Copy, Users2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ShareWithTeamModal } from "@/components/landing-pages/ShareWithTeamModal";

const LandingPageDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: page } = useQuery({
    queryKey: ["landing-page", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("landing_pages").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !authLoading,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["lp-registrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_registrations").select("*")
        .eq("landing_page_id", id!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !authLoading,
  });

  const filtered = (registrations as any[]).filter((r: any) => {
    const matchesSearch = !search ||
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.phone || "").includes(search);
    const matchesFilter = filter === "all" ||
      (filter === "email_sent" && r.confirmation_email_sent) ||
      (filter === "email_pending" && !r.confirmation_email_sent) ||
      (filter === "video_watched" && r.video_completed);
    return matchesSearch && matchesFilter;
  });

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "City", "State", "Occupation", "Submitted At", "Email Sent", "Video %"];
    const rows = (registrations as any[]).map((r: any) => [
      r.name, r.phone, r.email, r.city, r.state, r.occupation,
      r.submitted_at ? format(new Date(r.submitted_at), "yyyy-MM-dd HH:mm") : "",
      r.confirmation_email_sent ? "Yes" : "No",
      r.video_watch_percentage || 0,
    ]);
    const csv = [headers.join(","), ...rows.map((r: any) => r.map((c: any) => `"${c || ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `registrations-${(page as any)?.slug || id}.csv`; a.click();
    toast.success("CSV exported");
  };

  const maskPhone = (phone: string) => phone ? phone.slice(0, -3) + "***" : "—";

  if (authLoading || !page) return <DashboardLayout><div className="animate-pulse p-8">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/landing-pages/" })}>
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{(page as any).title}</h1>
            <p className="text-sm text-muted-foreground">{window.location.origin}/l/{(page as any).slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppShareButton
              url={`${typeof window !== "undefined" ? window.location.origin : ""}/l/${(page as any).slug}`}
              message={`Check this out: ${(page as any).title}`}
              size="sm"
            />
            <Button variant="outline" onClick={() => id && navigate({ to: "/landing-pages/$id/edit", params: { id } })}>
              <Pencil size={14} className="mr-2" /> Edit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Views", value: (page as any).total_views || 0, icon: Eye },
            { label: "Registrations", value: (page as any).total_registrations || 0, icon: Users },
            { label: "Conversion", value: (page as any).total_views ? `${(((page as any).total_registrations || 0) / (page as any).total_views * 100).toFixed(1)}%` : "0%", icon: Users },
            { label: "Emails Sent", value: (registrations as any[]).filter((r: any) => r.confirmation_email_sent).length, icon: Mail },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <s.icon size={14} /> {s.label}
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-semibold">Registrations ({(registrations as any[]).length})</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 w-48" />
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download size={14} className="mr-1" /> CSV
              </Button>
            </div>
          </div>

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="email_sent" className="text-xs">Email Sent</TabsTrigger>
              <TabsTrigger value="email_pending" className="text-xs">Pending</TabsTrigger>
              <TabsTrigger value="video_watched" className="text-xs">Video Watched</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No registrations yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name || "—"}</TableCell>
                      <TableCell>{maskPhone(r.phone)}</TableCell>
                      <TableCell className="text-sm">{r.email || "—"}</TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.confirmation_email_sent && <Badge variant="outline" className="text-[10px]">✅ Mail</Badge>}
                          {r.video_completed && <Badge variant="outline" className="text-[10px]">🎬 Video</Badge>}
                          {r.user_id && <Badge variant="outline" className="text-[10px]">👤 Account</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.submitted_at ? format(new Date(r.submitted_at), "d MMM, h:mm a") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default LandingPageDetail;
