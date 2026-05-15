import { Link } from "@/lib/router-compat";
import { Layers, Video, FileText, Radio } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

export const DashboardContentRow = () => {
  const { config, counts } = usePlanLimits();

  const items = [
    { icon: Layers, label: "Funnels", used: counts.funnels, limit: config.max_funnels, href: "/flows" },
    { icon: Video, label: "Videos", used: counts.videos, limit: config.max_videos ?? 0, href: "/videos" },
    { icon: FileText, label: "Landing Pages", used: counts.landing_pages, limit: config.max_landing_pages, href: "/landing-pages" },
    { icon: Radio, label: "Live Sessions", used: counts.live_sessions, limit: config.max_live_sessions, href: "/live" },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card/40 sm:grid-cols-4">
      {items.map((item, i) => (
        <Link
          key={item.label}
          to={item.href}
          className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 ${
            i < items.length - 1 ? "border-b border-r border-border sm:border-b-0" : ""
          } ${i === 1 ? "sm:border-r" : ""} ${i === items.length - 2 ? "sm:border-b-0" : ""}`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <item.icon size={16} />
          </div>
          <div className="min-w-0 flex-col">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="text-base font-bold leading-tight">
              {item.used} <span className="text-muted-foreground/60 font-normal">/ {item.limit === -1 ? "∞" : item.limit}</span>
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
};
