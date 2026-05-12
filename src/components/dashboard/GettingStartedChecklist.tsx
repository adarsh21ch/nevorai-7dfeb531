import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { CheckCircle2, Circle, Video, Layers, Share2, Users, X, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "nf_getting_started_dismissed";

type Step = {
  id: string;
  title: string;
  description: string;
  icon: typeof Video;
  cta: string;
  href: string;
  done: boolean;
};

export function GettingStartedChecklist() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {}
  }, []);

  const { data: videoCount = 0 } = useQuery({
    queryKey: ["gs-videos", user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("videos")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["gs-funnels", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("funnels")
        .select("id, total_views, total_leads")
        .eq("owner_id", user!.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    const arr = funnels as any[];
    return {
      hasFunnel: arr.length > 0,
      hasView: arr.some((f) => (f.total_views || 0) > 0),
      hasLead: arr.some((f) => (f.total_leads || 0) > 0),
    };
  }, [funnels]);

  const steps: Step[] = [
    {
      id: "video",
      title: "Upload your first video",
      description: "Drop in a 30–90 second video about your offer.",
      icon: Video,
      cta: "Upload video",
      href: "/videos",
      done: videoCount > 0,
    },
    {
      id: "funnel",
      title: "Create your first funnel",
      description: "Turn the video into a lead-capturing page.",
      icon: Layers,
      cta: "Create funnel",
      href: "/funnels/create",
      done: totals.hasFunnel,
    },
    {
      id: "share",
      title: "Share on WhatsApp",
      description: "Send your link to 10 contacts to get your first views.",
      icon: Share2,
      cta: "Open funnels",
      href: "/funnels",
      done: totals.hasView,
    },
    {
      id: "lead",
      title: "Get your first lead",
      description: "Watch leads roll in as people register on your funnel.",
      icon: Users,
      cta: "View leads",
      href: "/leads",
      done: totals.hasLead,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-5">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X size={16} />
      </button>

      <div className="flex flex-col gap-1 pr-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={18} />
            <h2 className="text-base font-heading font-bold">Get to your first lead in 5 minutes</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Finish these steps to launch your first Nevorai Flow funnel.
          </p>
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {completed} of {total} done
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li
              key={s.id}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                s.done
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-border bg-card/60 hover:border-primary/40"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {s.done ? (
                  <CheckCircle2 className="text-emerald-500" size={20} />
                ) : (
                  <Circle className="text-muted-foreground" size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon size={14} className={s.done ? "text-emerald-500" : "text-primary"} />
                  <span
                    className={`text-sm font-semibold ${
                      s.done ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {i + 1}. {s.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                {!s.done && (
                  <Link
                    to={s.href}
                    className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    {s.cta} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
