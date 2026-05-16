import { Eye, UserPlus, Radio, Layers, FileText, Video } from "lucide-react";
import { Link } from "@/lib/router-compat";

export type ActivityItem = {
  id: string;
  kind: "lead" | "registration" | "view";
  entityType: "funnel" | "landing_page" | "video" | "live_session";
  entityTitle: string;
  entityHref?: string;
  who?: string | null;
  at: string; // ISO
  meta?: string;
};

const ICONS: Record<string, any> = {
  lead: UserPlus,
  registration: UserPlus,
  view: Eye,
};

const ENTITY_ICONS: Record<string, any> = {
  funnel: Layers,
  landing_page: FileText,
  video: Video,
  live_session: Radio,
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function groupKey(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86400_000) return "Yesterday";
  if (t >= startOfToday - 7 * 86400_000) return "This Week";
  return "Earlier";
}

export function ActivityFeed({ items, emptyHint }: { items: ActivityItem[]; emptyHint?: string }) {
  if (!items.length) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">{emptyHint ?? "No activity yet. Share a link to start collecting events."}</p>
      </div>
    );
  }
  const groups: Record<string, ActivityItem[]> = {};
  items.forEach((it) => {
    const g = groupKey(it.at);
    (groups[g] ||= []).push(it);
  });
  const order = ["Today", "Yesterday", "This Week", "Earlier"];
  return (
    <div className="space-y-5">
      {order
        .filter((g) => groups[g]?.length)
        .map((g) => (
          <div key={g}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{g}</div>
            <ul className="space-y-1.5">
              {groups[g].map((it) => {
                const KindIcon = ICONS[it.kind] ?? Eye;
                const EntityIcon = ENTITY_ICONS[it.entityType] ?? Layers;
                const body = (
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/10 grid place-items-center shrink-0">
                      <KindIcon size={13} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">
                        <span className="font-medium">
                          {it.kind === "lead"
                            ? "New lead"
                            : it.kind === "registration"
                              ? "New registration"
                              : "View"}
                        </span>
                        {it.who ? <span className="text-muted-foreground"> · {it.who}</span> : null}
                        {it.meta ? <span className="text-muted-foreground"> · {it.meta}</span> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <EntityIcon size={10} />
                        <span className="truncate">{it.entityTitle}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0">{timeAgo(it.at)}</div>
                  </div>
                );
                return (
                  <li key={it.id}>
                    {it.entityHref ? <Link to={it.entityHref}>{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </div>
  );
}
