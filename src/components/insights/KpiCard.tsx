import { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { formatCompact } from "@/lib/format";
import { TrendChip } from "./TrendChip";
import { Sparkline } from "./Sparkline";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  previous?: number;
  spark?: number[];
  suffix?: string;
  live?: React.ReactNode;
}

export function KpiCard({ icon: Icon, label, value, previous = 0, spark = [], suffix, live }: KpiCardProps) {
  const animated = useCountUp(value);
  const display = formatCompact(Math.round(animated));
  return (
    <div className="premium-card p-4 group min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="stat-icon group-hover:scale-105 transition-transform shrink-0">
            <Icon size={16} className="text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium truncate">{label}</span>
        </div>
        {live ?? <TrendChip current={value} previous={previous} />}
      </div>
      <div className="flex items-baseline gap-1">
        <div className="text-2xl font-heading font-bold tabular-nums">{display}</div>
        {suffix ? <div className="text-xs text-muted-foreground">{suffix}</div> : null}
      </div>
      <div className="mt-2 -mx-1">
        <Sparkline data={spark} />
      </div>
    </div>
  );
}
