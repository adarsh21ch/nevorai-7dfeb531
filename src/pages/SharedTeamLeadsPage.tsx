import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Users, Mail, Share2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const sb: any = supabase;

const SharedTeamLeadsPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(true);
  const [accepted, setAccepted] = useState<{ landing_page_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // 1. Resolve token info (works for anon + authed) — never returns leads.
  const { data: shareInfo, isLoading: infoLoading } = useQuery({
    queryKey: ["share-info", token],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_landing_page_share_info", { p_token: token });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!token,
  });

  // 2. If not authed → bounce to /auth with redirect back here.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const here = typeof window !== "undefined" ? window.location.pathname : `/team/leads/${token}`;
      navigate({ to: "/auth", search: { redirect: here }, replace: true });
    }
  }, [authLoading, user, token, navigate]);

  // 3. Authed → accept the share.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !token) return;
      if (shareInfo && shareInfo.is_active === false) {
        setAccepting(false);
        setError("This shared link is no longer active.");
        return;
      }
      const { data, error } = await sb.rpc("accept_landing_page_share", { p_token: token });
      if (cancelled) return;
      setAccepting(false);
      if (error) { setError(error.message); return; }
      setAccepted({ landing_page_id: data as string });
    })();
    return () => { cancelled = true; };
  }, [user, token, shareInfo]);

  const landingPageId = accepted?.landing_page_id || shareInfo?.landing_page_id;

  // 4. Load leads (RLS lets collaborators see them).
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["shared-lp-leads", landingPageId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("landing_page_registrations").select("*")
        .eq("landing_page_id", landingPageId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!landingPageId && !!accepted,
  });

  // 5. Realtime — scoped, cleaned up on unmount.
  useEffect(() => {
    if (!landingPageId || !accepted) return;
    const ch = sb.channel(`shared-leads-${landingPageId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "landing_page_registrations", filter: `landing_page_id=eq.${landingPageId}` },
        (payload: any) => {
          qc.setQueryData(["shared-lp-leads", landingPageId], (prev: any) => [payload.new, ...(prev || [])]);
          toast.success(`New lead: ${payload.new?.name || payload.new?.phone || "anonymous"}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "landing_page_registrations", filter: `landing_page_id=eq.${landingPageId}` },
        (payload: any) => {
          qc.setQueryData(["shared-lp-leads", landingPageId], (prev: any) =>
            (prev || []).map((r: any) => (r.id === payload.new.id ? payload.new : r)),
          );
        },
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [landingPageId, accepted, qc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads as any[];
    return (leads as any[]).filter((r) =>
      [r.name, r.email, r.phone, r.city].some((v: any) => (v || "").toString().toLowerCase().includes(q)),
    );
  }, [leads, search]);

  const exportCSV = () => {
    const headers = ["Name", "Phone", "Email", "City", "State", "Occupation", "Submitted At"];
    const rows = (leads as any[]).map((r: any) => [
      r.name, r.phone, r.email, r.city, r.state, r.occupation,
      r.submitted_at ? format(new Date(r.submitted_at), "yyyy-MM-dd HH:mm") : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r: any) => r.map((c: any) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `shared-leads-${landingPageId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // ---- Render states ----
  if (authLoading || infoLoading || accepting) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="animate-spin" size={18} /> Connecting you to the shared leads…
        </div>
      </DashboardLayout>
    );
  }

  if (error || !shareInfo) {
    return (
      <DashboardLayout>
        <Card className="p-10 max-w-md mx-auto text-center space-y-3 mt-12">
          <Share2 className="mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">This shared link is no longer active</h2>
          <p className="text-sm text-muted-foreground">{error || "Ask the owner to send you a new link."}</p>
          <Button onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard</Button>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Share2 size={12} /> Shared by <strong>{shareInfo.owner_name}</strong> · Viewer access
          </div>
          <h1 className="text-2xl font-bold mt-1">{shareInfo.landing_page_title}</h1>
          <p className="text-sm text-muted-foreground">Leads update live as new people submit the form.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Users size={14} /> Total leads</div>
            <div className="text-2xl font-bold">{(leads as any[]).length}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Mail size={14} /> Emails captured</div>
            <div className="text-2xl font-bold">{(leads as any[]).filter((r: any) => r.email).length}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">📞 Phones captured</div>
            <div className="text-2xl font-bold">{(leads as any[]).filter((r: any) => r.phone).length}</div>
          </Card>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-semibold">Leads ({(leads as any[]).length})</h2>
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
                {leadsLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads yet.</TableCell></TableRow>
                ) : (
                  filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name || "—"}</TableCell>
                      <TableCell>{r.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{r.email || "—"}</TableCell>
                      <TableCell>{r.city || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.confirmation_email_sent && <Badge variant="outline" className="text-[10px]">✅ Mail</Badge>}
                          {r.video_completed && <Badge variant="outline" className="text-[10px]">🎬 Video</Badge>}
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

export default SharedTeamLeadsPage;
