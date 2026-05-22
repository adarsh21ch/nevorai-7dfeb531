import { useMemo, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, Search, GraduationCap, X, CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Tutorial = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
  is_published: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  "getting-started": "Getting started",
  videos: "Videos",
  funnels: "Funnels",
  "landing-pages": "Landing pages",
  live: "Live sessions",
  sharing: "Share & WhatsApp",
  billing: "Billing & plans",
  advanced: "Advanced",
};

const isEmbedUrl = (url: string) =>
  /youtube\.com\/embed|player\.vimeo\.com|youtu\.be\/embed/.test(url);

export default function HelpCenterPage() {
  useDocumentTitle("Nevorai Academy · Tutorials");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Tutorial | null>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["academy-tutorials-public"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("academy_tutorials")
        .select("*")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data || []) as Tutorial[];
    },
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["academy-completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_completions")
        .select("tutorial_id")
        .eq("user_id", user!.id);
      return (data || []).map((r: any) => r.tutorial_id as string);
    },
  });

  const completedSet = useMemo(() => new Set(completions), [completions]);

  const toggleComplete = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      if (!user) throw new Error("Sign in required");
      if (done) {
        const { error } = await (supabase as any)
          .from("academy_completions")
          .insert({ user_id: user.id, tutorial_id: id });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("academy_completions")
          .delete()
          .eq("user_id", user.id)
          .eq("tutorial_id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["academy-completions", user?.id] });
      toast.success(v.done ? "Marked as completed" : "Marked as not completed");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const filtered = useMemo(() => {
    if (!query) return tutorials;
    const q = query.toLowerCase();
    return tutorials.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [tutorials, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tutorial[]>();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const progress = tutorials.length === 0
    ? 0
    : Math.round((completions.filter((id) => tutorials.some((t) => t.id === id)).length / tutorials.length) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-3xl">
              <GraduationCap className="text-primary" /> Nevorai Academy
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Short tutorials that show you exactly how to use Nevorai. Watch them in order to master every feature.
            </p>
          </div>
          {tutorials.length > 0 && (
            <div className="w-full sm:w-64">
              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground sm:text-xs">
                <span>Your progress</span>
                <span className="font-semibold text-foreground">
                  {completedSet.size}/{tutorials.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
                {progress === 100
                  ? "🎉 You've completed every tutorial!"
                  : `${progress}% complete — keep going!`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Search tutorials..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={16} /> Loading tutorials…
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="mx-auto mb-3 text-primary" />
          <h3 className="text-base font-semibold">No tutorials yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {query ? `Nothing matches "${query}".` : "Check back soon — new videos are added regularly."}
          </p>
        </Card>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold sm:text-lg">{CATEGORY_LABELS[cat] || cat}</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t, i) => {
                const done = completedSet.has(t.id);
                return (
                  <div key={t.id} className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md">
                    <button onClick={() => setActive(t)} className="block w-full text-left">
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        {t.thumbnail_url ? (
                          <img src={t.thumbnail_url} alt={t.title} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                            <PlayCircle className="text-primary/60" size={48} />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
                          #{i + 1}
                        </div>
                        {done && (
                          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                            <CheckCircle2 size={12} /> Completed
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                          <PlayCircle className="text-white" size={56} />
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="font-semibold leading-tight">{t.title}</div>
                        {t.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-border px-3 py-2">
                      <Button
                        size="sm"
                        variant={done ? "ghost" : "outline"}
                        className="h-7 gap-1 text-[11px]"
                        disabled={!user || toggleComplete.isPending}
                        onClick={(e) => { e.stopPropagation(); toggleComplete.mutate({ id: t.id, done: !done }); }}
                      >
                        {done ? <><CheckCircle2 size={12} className="text-green-500" /> Completed</> : <><Circle size={12} /> Mark complete</>}
                      </Button>
                      <Button size="sm" variant="hero" className="h-7 text-[11px]" onClick={() => setActive(t)}>
                        <PlayCircle size={12} /> Watch
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="min-w-0 truncate pr-2 font-semibold">{active.title}</div>
              <button onClick={() => setActive(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              {isEmbedUrl(active.video_url) ? (
                <iframe
                  src={active.video_url}
                  title={active.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={active.video_url}
                  controls
                  playsInline
                  className="h-full w-full"
                  onEnded={() => {
                    if (user && !completedSet.has(active.id)) {
                      toggleComplete.mutate({ id: active.id, done: true });
                    }
                  }}
                />
              )}
            </div>
            {active.description && (
              <div className="border-t border-border p-3 text-sm text-muted-foreground">{active.description}</div>
            )}
            <div className="flex items-center justify-between border-t border-border p-3">
              <Button
                variant={completedSet.has(active.id) ? "ghost" : "hero"}
                size="sm"
                disabled={!user || toggleComplete.isPending}
                onClick={() => toggleComplete.mutate({ id: active.id, done: !completedSet.has(active.id) })}
              >
                {completedSet.has(active.id) ? (
                  <><CheckCircle2 size={14} className="text-green-500" /> Completed</>
                ) : (
                  <><Circle size={14} /> Mark as complete</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActive(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
