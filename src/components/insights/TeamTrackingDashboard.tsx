import { useMemo, useState } from "react";
import {
  useTeamTracking,
  useTeamLabels,
  useColumnConfig,
  useHasTeam,
  type TeamTrackingPeriod,
  type TeamMatrixMember,
} from "@/lib/teamTracking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Tag, ChevronRight, ArrowUpDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportCsvButton } from "@/components/insights/ExportCsvButton";
import { ColumnConfigDialog } from "@/components/insights/ColumnConfigDialog";
import { LabelManagerDialog } from "@/components/insights/LabelManagerDialog";
import { InsightsEmptyState } from "@/components/insights/EmptyState";
import { formatCompact } from "@/lib/format";

const PERIODS: { v: TeamTrackingPeriod; l: string }[] = [
  { v: "today", l: "Today" },
  { v: "7d", l: "7 days" },
  { v: "30d", l: "30 days" },
  { v: "all", l: "All" },
];

export function TeamTrackingDashboard() {
  const [period, setPeriod] = useState<TeamTrackingPeriod>("30d");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [sortByTotal, setSortByTotal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCols, setShowCols] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const { data, isLoading } = useTeamTracking(period);
  const { data: labels = [] } = useTeamLabels();
  const { data: colOrder = [] } = useColumnConfig();
  const { data: hasTeam } = useHasTeam();

  const orderedFunnels = useMemo(() => {
    const all = data?.funnels ?? [];
    if (!colOrder.length) return all;
    const map = new Map(all.map((f) => [f.id, f]));
    const ordered = colOrder.map((id) => map.get(id)).filter(Boolean) as typeof all;
    const rest = all.filter((f) => !colOrder.includes(f.id));
    return [...ordered, ...rest];
  }, [data, colOrder]);

  const filteredMembers = useMemo(() => {
    let members = data?.members ?? [];
    if (activeLabels.length) {
      members = members.filter((m) => m.label_id && activeLabels.includes(m.label_id));
    }
    if (sortByTotal) {
      members = [...members].sort((a, b) => {
        if (a.is_you !== b.is_you) return a.is_you ? -1 : 1;
        return b.total_viewers - a.total_viewers;
      });
    }
    return members;
  }, [data, activeLabels, sortByTotal]);

  const totalsByFunnel = useMemo(() => {
    const map = new Map<string, { viewers: number; leads: number }>();
    for (const m of filteredMembers) {
      for (const c of m.funnels) {
        const cur = map.get(c.funnel_id) ?? { viewers: 0, leads: 0 };
        map.set(c.funnel_id, { viewers: cur.viewers + c.viewers, leads: cur.leads + c.leads });
      }
    }
    return map;
  }, [filteredMembers]);

  const grand = useMemo(() => {
    let v = 0, l = 0;
    for (const m of filteredMembers) { v += m.total_viewers; l += m.total_leads; }
    return { v, l };
  }, [filteredMembers]);

  const youRow = data?.members.find((m) => m.is_you);
  const yourViewers = youRow?.total_viewers ?? 0;
  const yourLeads = youRow?.total_leads ?? 0;

  const csvRows = useMemo(() => {
    return filteredMembers.map((m) => {
      const row: Record<string, any> = { Member: m.name + (m.is_you ? " (You)" : "") };
      for (const f of orderedFunnels) {
        const c = m.funnels.find((x) => x.funnel_id === f.id);
        row[`${f.name} — viewers`] = c?.viewers ?? 0;
        row[`${f.name} — leads`] = c?.leads ?? 0;
      }
      row["Total viewers"] = m.total_viewers;
      row["Total leads"] = m.total_leads;
      return row;
    });
  }, [filteredMembers, orderedFunnels]);

  if (isLoading && !data) {
    return <div className="premium-card p-6 text-sm text-muted-foreground">Loading team tracking…</div>;
  }

  const showSoloHint = !hasTeam;
  const noFunnels = (data?.funnels.length ?? 0) === 0;

  if (noFunnels) {
    return (
      <InsightsEmptyState
        icon={Users}
        title="No funnels yet"
        hint="Create a funnel to start sharing — your numbers (and your team's) will appear here."
      />
    );
  }


  return (
    <div className="space-y-4">
      {showSoloHint && (
        <div className="premium-card p-3 md:p-4 flex flex-wrap items-center justify-between gap-2 border-dashed">
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">Solo for now.</span> Connect teammates from <span className="text-foreground">Profile → Team</span> to see their numbers in this sheet alongside yours.
          </div>
        </div>
      )}

      {/* KPI Header */}
      <div className="premium-card p-4 md:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Team total viewers</div>
            <div className="text-3xl md:text-4xl font-heading font-semibold tabular-nums">{formatCompact(grand.v)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Your viewers: <span className="text-foreground font-medium">{formatCompact(yourViewers)}</span></div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Team leads: <span className="text-foreground">{formatCompact(grand.l)}</span> · Your leads: <span className="text-foreground">{formatCompact(yourLeads)}</span>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPeriod(p.v)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md border",
                  period === p.v
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action row: labels filter + settings + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {labels.map((lbl) => {
            const on = activeLabels.includes(lbl.id);
            return (
              <button
                key={lbl.id}
                onClick={() =>
                  setActiveLabels((prev) => (on ? prev.filter((x) => x !== lbl.id) : [...prev, lbl.id]))
                }
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border",
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-transparent text-muted-foreground border-border",
                )}
              >
                {lbl.name}
              </button>
            );
          })}
          {activeLabels.length > 0 && (
            <button onClick={() => setActiveLabels([])} className="text-[11px] text-muted-foreground underline">
              clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setSortByTotal((s) => !s)}>
            <ArrowUpDown size={12} /> {sortByTotal ? "Sorted by total" : "Sort by total"}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowLabels(true)}>
            <Tag size={12} /> Labels
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowCols(true)}>
            <Settings size={12} /> Columns
          </Button>
          <ExportCsvButton rows={csvRows} filename={`team-tracking-${period}.csv`} />
        </div>
      </div>

      {/* Excel-style table */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[140px]">Member</th>
                {orderedFunnels.map((f) => (
                  <th key={f.id} className="text-right font-medium px-3 py-2 whitespace-nowrap min-w-[110px]">{f.name}</th>
                ))}
                <th className="text-right font-medium px-3 py-2 whitespace-nowrap min-w-[90px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <MemberRow
                  key={m.id}
                  m={m}
                  funnels={orderedFunnels}
                  expanded={expanded === m.id}
                  onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                />
              ))}
              {filteredMembers.length === 0 && (
                <tr><td colSpan={orderedFunnels.length + 2} className="text-center text-xs text-muted-foreground py-6">No members match this filter.</td></tr>
              )}
            </tbody>
            {filteredMembers.length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 border-t border-border text-xs font-medium">
                  <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10">Team total</td>
                  {orderedFunnels.map((f) => {
                    const t = totalsByFunnel.get(f.id) ?? { viewers: 0, leads: 0 };
                    return (
                      <td key={f.id} className="px-3 py-2 text-right tabular-nums">
                        <div>{formatCompact(t.viewers)}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{formatCompact(t.leads)} leads</div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div>{formatCompact(grand.v)}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{formatCompact(grand.l)} leads</div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ColumnConfigDialog
        open={showCols}
        onOpenChange={setShowCols}
        funnels={data?.funnels ?? []}
        currentOrder={colOrder}
      />
      <LabelManagerDialog
        open={showLabels}
        onOpenChange={setShowLabels}
        members={data?.members ?? []}
      />
    </div>
  );
}

function MemberRow({
  m, funnels, expanded, onToggle,
}: { m: TeamMatrixMember; funnels: { id: string; name: string }[]; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={cn("border-t border-border hover:bg-muted/20 cursor-pointer", m.is_you && "bg-primary/[0.03]")} onClick={onToggle}>
        <td className="px-3 py-2 sticky left-0 bg-background z-10">
          <div className="flex items-center gap-2">
            <ChevronRight size={12} className={cn("transition-transform text-muted-foreground", expanded && "rotate-90")} />
            <span className="font-medium truncate max-w-[140px]">{m.name}</span>
            {m.is_you && <Badge variant="secondary" className="text-[9px] px-1 py-0">You</Badge>}
          </div>
        </td>
        {funnels.map((f) => {
          const c = m.funnels.find((x) => x.funnel_id === f.id);
          const v = c?.viewers ?? 0; const l = c?.leads ?? 0;
          return (
            <td key={f.id} className="px-3 py-2 text-right tabular-nums">
              <div className={cn("text-base font-medium", v === 0 && "text-muted-foreground/50")}>{formatCompact(v)}</div>
              <div className="text-[10px] text-muted-foreground">{l ? `${formatCompact(l)} leads` : "—"}</div>
            </td>
          );
        })}
        <td className="px-3 py-2 text-right tabular-nums">
          <div className="text-base font-semibold">{formatCompact(m.total_viewers)}</div>
          <div className="text-[10px] text-muted-foreground">{m.total_leads ? `${formatCompact(m.total_leads)} leads` : "—"}</div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/10 border-t border-border/50">
          <td colSpan={funnels.length + 2} className="px-4 py-3 text-xs text-muted-foreground">
            <div className="grid sm:grid-cols-2 gap-2">
              {m.funnels.map((c) => {
                const f = funnels.find((x) => x.id === c.funnel_id);
                if (!f) return null;
                return (
                  <div key={c.funnel_id} className="flex items-center justify-between gap-3 p-2 rounded bg-background border border-border/50">
                    <span className="truncate">{f.name}</span>
                    <span className="tabular-nums">{formatCompact(c.viewers)} viewers · {formatCompact(c.leads)} leads</span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
