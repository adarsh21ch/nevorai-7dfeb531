import { Link } from "@/lib/router-compat";
import { LucideIcon, Eye, UserCheck, ArrowUpRight } from "lucide-react";
import { formatCompact, formatRelativeDate } from "@/lib/format";
import { LivePulseDot } from "./LivePulseDot";
import { Sparkline } from "./Sparkline";

export interface EntityCardProps {
  icon: LucideIcon;
  title: string;
  href: string;
  thumbnail?: string | null;
  views?: number;
  leads?: number;
  leadsLabel?: string;
  spark?: number[];
  liveCount?: number;
  badge?: { label: string; tone?: "default" | "success" | "warning" | "muted" } | null;
  createdAt?: string | null;
  variant?: "grid" | "list";
}

const TONE: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/15 text-emerald-500",
  warning: "bg-amber-500/15 text-amber-600",
  muted: "bg-muted text-muted-foreground",
};

export function EntityCard({
  icon: Icon,
  title,
  href,
  thumbnail,
  views = 0,
  leads = 0,
  leadsLabel = "leads",
  spark = [],
  liveCount = 0,
  badge,
  createdAt,
  variant = "grid",
}: EntityCardProps) {
  if (variant === "list") {
    return (
      <Link
        to={href}
        className="premium-card p-3 flex items-center gap-3 hover:border-primary/40 transition-colors group"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Icon size={18} className="text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">{title}</h4>
            {liveCount > 0 ? <LivePulseDot label={`${liveCount}`} /> : null}
            {badge ? (
              <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${TONE[badge.tone ?? "default"]}`}>
                {badge.label}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5">
            <span className="inline-flex items-center gap-1"><Eye size={10} />{formatCompact(views)}</span>
            <span className="inline-flex items-center gap-1"><UserCheck size={10} />{formatCompact(leads)} {leadsLabel}</span>
            {createdAt ? <span>· {formatRelativeDate(createdAt)}</span> : null}
          </div>
        </div>
        <ArrowUpRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      to={href}
      className="premium-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors group min-w-0"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="stat-icon shrink-0">
            <Icon size={14} className="text-primary" />
          </div>
          <h4 className="text-sm font-semibold truncate">{title}</h4>
        </div>
        {liveCount > 0 ? (
          <LivePulseDot label={`${liveCount} live`} />
        ) : badge ? (
          <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${TONE[badge.tone ?? "default"]}`}>
            {badge.label}
          </span>
        ) : null}
      </div>
      {thumbnail ? (
        <div className="aspect-video rounded-lg bg-muted overflow-hidden">
          <img src={thumbnail} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Views</div>
          <div className="text-lg font-heading font-bold tabular-nums">{formatCompact(views)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{leadsLabel}</div>
          <div className="text-lg font-heading font-bold tabular-nums">{formatCompact(leads)}</div>
        </div>
      </div>
      {spark.length > 0 ? (
        <div className="-mx-1">
          <Sparkline data={spark} height={28} />
        </div>
      ) : null}
      {createdAt ? (
        <div className="text-[10px] text-muted-foreground">{formatRelativeDate(createdAt)}</div>
      ) : null}
    </Link>
  );
}
