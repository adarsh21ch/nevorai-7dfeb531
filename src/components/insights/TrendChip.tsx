import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small inline pill showing % change vs previous period. */
export function TrendChip({ current, previous, className }: { current: number; previous: number; className?: string }) {
  const hasPrev = previous > 0;
  const delta = hasPrev ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const up = delta > 0;
  const flat = !hasPrev || Math.abs(delta) < 0.1;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        flat
          ? "bg-muted text-muted-foreground"
          : up
            ? "bg-emerald-500/15 text-emerald-500"
            : "bg-rose-500/15 text-rose-500",
        className,
      )}
      title={hasPrev ? `vs previous period` : "no previous data"}
    >
      <Icon size={10} />
      {flat ? "0%" : `${Math.abs(delta).toFixed(0)}%`}
    </span>
  );
}
