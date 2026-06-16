import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, Link as LinkIcon, Users, Share2, Search, Download, RefreshCw } from "lucide-react";
import { BRAND } from "@/config/brand";

type TeamRow = {
  upline_id: string;
  member_id: string;
  connected_at: string;
  source: string;
  member_name: string | null;
  member_email: string | null;
  member_avatar: string | null;
  funnel_id: string;
  funnel_title: string;
  funnel_slug: string;
  share_link_id: string | null;
  share_token: string | null;
  link_active: boolean | null;
};

type StatsRow = {
  share_link_id: string;
  label: string;
  is_universal: boolean;
  funnel_step_id: string;
  step_title: string;
  step_order: number;
  total_views: number;
  unique_views: number;
  leads: number;
};

const SITE_ORIGIN =
  (typeof window !== "undefined" && window.location.origin) || `https://${BRAND.domain}`;

const buildFunnelLink = (slug: string, token: string) =>
  `${SITE_ORIGIN}/f/${slug}?t=${token}`;

export default function MyTeamPage() {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>("");

  const connectLink = useMemo(() => {
    const token = (profile as any)?.connect_token;
    if (!token) return "";
    return `${SITE_ORIGIN}/join/${token}`;
  }, [profile]);

  // Generate QR for the connect link.
  useEffect(() => {
    if (!connectLink) return;
    QRCode.toDataURL(connectLink, { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [connectLink]);

  // Pull team_member_links view (one row per member × funnel).
  const teamQuery = useQuery({
    queryKey: ["team_member_links", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_member_links")
        .select("*")
        .eq("upline_id", user!.id)
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
  });

  const rows = teamQuery.data ?? [];

  // Group by member.
  const members = useMemo(() => {
    const map = new Map<
      string,
      {
        member_id: string;
        member_name: string;
        member_email: string;
        connected_at: string;
        source: string;
        funnels: TeamRow[];
      }
    >();
    for (const r of rows) {
      const key = r.member_id;
      if (!map.has(key)) {
        map.set(key, {
          member_id: r.member_id,
          member_name: r.member_name || "—",
          member_email: r.member_email || "",
          connected_at: r.connected_at,
          source: r.source,
          funnels: [],
        });
      }
      map.get(key)!.funnels.push(r);
    }
    let list = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.member_name.toLowerCase().includes(q) ||
          m.member_email.toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, search]);

  // Funnels list (for the tracking tab).
  const funnels = useMemo(() => {
    const seen = new Map<string, { id: string; title: string; slug: string }>();
    for (const r of rows) {
      if (!seen.has(r.funnel_id))
        seen.set(r.funnel_id, { id: r.funnel_id, title: r.funnel_title, slug: r.funnel_slug });
    }
    return Array.from(seen.values());
  }, [rows]);

  useEffect(() => {
    if (!selectedFunnelId && funnels.length > 0) setSelectedFunnelId(funnels[0].id);
  }, [funnels, selectedFunnelId]);

  const copy = async (text: string, msg = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <DashboardLayout>
      <div className="container-app py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" /> My Team
            </h1>
            <p className="text-sm text-muted-foreground">
              Share your connect link or QR. When team members join, all your funnels
              automatically get a personal tracking link for each of them.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => teamQuery.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Connect link + QR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" /> Your Connect Link
            </CardTitle>
            <CardDescription>
              Anyone who opens this link and signs in joins your team automatically.
              Same link forever — no need to create per-person links.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[1fr_auto] items-start">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={connectLink} className="font-mono text-sm" />
                <Button onClick={() => copy(connectLink, "Connect link copied")}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    shareWhatsApp(
                      `Hey! Join my team on ${BRAND.name} — you'll instantly get all my funnel share links to send to your prospects.\n\n${connectLink}`,
                    )
                  }
                >
                  <Share2 className="h-4 w-4 mr-1" /> Share on WhatsApp
                </Button>
                {qrDataUrl && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = qrDataUrl;
                      a.download = "connect-qr.png";
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" /> Download QR
                  </Button>
                )}
              </div>
            </div>
            {qrDataUrl ? (
              <div className="rounded-lg border bg-card p-3 flex flex-col items-center gap-2">
                <img src={qrDataUrl} alt="Connect QR" className="w-40 h-40" />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Scan to join
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Team Members ({members.length})</TabsTrigger>
            <TabsTrigger value="tracking">Team Tracking</TabsTrigger>
          </TabsList>

          {/* Members tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {teamQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : members.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No team members yet. Share your connect link or QR above to invite them.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {members.map((m) => (
                  <Card key={m.member_id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <CardTitle className="text-base">{m.member_name}</CardTitle>
                          <CardDescription className="text-xs">
                            {m.member_email} · joined {new Date(m.connected_at).toLocaleDateString()}
                            <Badge variant="secondary" className="ml-2">{m.source}</Badge>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funnel</TableHead>
                            <TableHead>Personal share link</TableHead>
                            <TableHead className="w-32 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.funnels.map((f) => {
                            const link = f.share_token
                              ? buildFunnelLink(f.funnel_slug, f.share_token)
                              : "";
                            return (
                              <TableRow key={f.funnel_id}>
                                <TableCell className="font-medium">{f.funnel_title}</TableCell>
                                <TableCell className="font-mono text-xs break-all">
                                  {link || <span className="text-muted-foreground">generating…</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {link && (
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copy(link, "Link copied")}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          shareWhatsApp(
                                            `Hi ${m.member_name}, here is your personal link for ${f.funnel_title}:\n${link}`,
                                          )
                                        }
                                      >
                                        <Share2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tracking tab */}
          <TabsContent value="tracking" className="space-y-4">
            {funnels.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Create a funnel and invite team members to start tracking.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {funnels.map((f) => (
                    <Button
                      key={f.id}
                      variant={selectedFunnelId === f.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFunnelId(f.id)}
                    >
                      {f.title}
                    </Button>
                  ))}
                </div>
                {selectedFunnelId && <TrackingTable funnelId={selectedFunnelId} />}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function TrackingTable({ funnelId }: { funnelId: string }) {
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  const statsQuery = useQuery({
    queryKey: ["team_tracking_stats", funnelId, range],
    queryFn: async () => {
      const now = new Date();
      let from: Date | null = null;
      if (range === "7d") from = new Date(now.getTime() - 7 * 86400_000);
      if (range === "30d") from = new Date(now.getTime() - 30 * 86400_000);
      const { data, error } = await (supabase as any).rpc("team_tracking_stats", {
        p_funnel_id: funnelId,
        p_from: from ? from.toISOString() : null,
        p_to: null,
      });
      if (error) throw error;
      return (data ?? []) as StatsRow[];
    },
  });

  const grid = useMemo(() => {
    const rows = statsQuery.data ?? [];
    const steps = new Map<string, { id: string; title: string; order: number }>();
    const members = new Map<
      string,
      { id: string; label: string; is_universal: boolean; perStep: Record<string, StatsRow> }
    >();
    for (const r of rows) {
      if (!steps.has(r.funnel_step_id))
        steps.set(r.funnel_step_id, { id: r.funnel_step_id, title: r.step_title, order: r.step_order });
      if (!members.has(r.share_link_id))
        members.set(r.share_link_id, {
          id: r.share_link_id,
          label: r.label,
          is_universal: r.is_universal,
          perStep: {},
        });
      members.get(r.share_link_id)!.perStep[r.funnel_step_id] = r;
    }
    return {
      steps: Array.from(steps.values()).sort((a, b) => a.order - b.order),
      members: Array.from(members.values()).sort((a, b) =>
        a.is_universal === b.is_universal ? a.label.localeCompare(b.label) : a.is_universal ? -1 : 1,
      ),
    };
  }, [statsQuery.data]);

  const exportCsv = () => {
    const header = ["Member", ...grid.steps.map((s) => `${s.title} (unique)`), ...grid.steps.map((s) => `${s.title} (leads)`), "Total unique", "Total leads"];
    const rows = grid.members.map((m) => {
      let totalUnique = 0;
      let totalLeads = 0;
      const uniques = grid.steps.map((s) => {
        const v = m.perStep[s.id]?.unique_views ?? 0;
        totalUnique += Number(v);
        return v;
      });
      const leads = grid.steps.map((s) => {
        const v = m.perStep[s.id]?.leads ?? 0;
        totalLeads += Number(v);
        return v;
      });
      return [m.label, ...uniques, ...leads, totalUnique, totalLeads];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-tracking-${funnelId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base">Per member × per step</CardTitle>
          <CardDescription>Unique views and leads attributed to each team member.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "all"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
            >
              {r === "all" ? "All time" : r === "7d" ? "Last 7 days" : "Last 30 days"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {statsQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : grid.members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                {grid.steps.map((s) => (
                  <TableHead key={s.id} className="text-center">{s.title}</TableHead>
                ))}
                <TableHead className="text-center">Total unique</TableHead>
                <TableHead className="text-center">Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grid.members.map((m) => {
                let totalUnique = 0;
                let totalLeads = 0;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.label} {m.is_universal && <Badge variant="secondary" className="ml-1">Direct</Badge>}
                    </TableCell>
                    {grid.steps.map((s) => {
                      const cell = m.perStep[s.id];
                      const u = Number(cell?.unique_views ?? 0);
                      const l = Number(cell?.leads ?? 0);
                      totalUnique += u;
                      totalLeads += l;
                      return (
                        <TableCell key={s.id} className="text-center">
                          <div className="font-medium">{u}</div>
                          {l > 0 && <div className="text-[10px] text-primary">{l} lead{l > 1 ? "s" : ""}</div>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-semibold">{totalUnique}</TableCell>
                    <TableCell className="text-center font-semibold">{totalLeads}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
