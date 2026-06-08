import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlayCircle, Search, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TutorialFormat = "short" | "full";

type Tutorial = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  order_index: number;
  is_published: boolean;
  format: TutorialFormat;
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

export default function PublicAcademyPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TutorialFormat>("short");

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["academy-tutorials-public"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,description,video_url,thumbnail_url,category,order_index,is_published,format")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return ((data || []) as Tutorial[]).map((t) => ({
        ...t,
        format: (t.format === "full" ? "full" : "short") as TutorialFormat,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoryOrder = [] } = useQuery({
    queryKey: ["academy-category-order-public"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_category_order")
        .select("category, order_index")
        .order("order_index", { ascending: true });
      return (data || []) as { category: string; order_index: number }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const shortsCount = useMemo(() => tutorials.filter((t) => t.format === "short").length, [tutorials]);
  const fullCount = useMemo(() => tutorials.filter((t) => t.format === "full").length, [tutorials]);

  const filtered = useMemo(() => {
    const byFormat = tutorials.filter((t) => t.format === tab);
    if (!query) return byFormat;
    const q = query.toLowerCase();
    return byFormat.filter(
      (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [tutorials, query, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tutorial[]>();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    const orderMap = new Map(categoryOrder.map((c) => [c.category, c.order_index]));
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = orderMap.get(a) ?? 999;
      const bi = orderMap.get(b) ?? 999;
      return ai - bi;
    });
  }, [filtered, categoryOrder]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container-app py-8 sm:py-12 space-y-8">
        <header className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-10">
          <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-3">
            <GraduationCap size={18} /> Nevorai Academy
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Learn to turn videos into leads — free.
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-muted-foreground">
            Short, no-fluff tutorials for coaches, network marketers and entrepreneurs.
            Swipe through Shorts or watch Full Videos. No signup required.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/auth?tab=signup">
              <Button variant="hero" size="lg">Sign up free</Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg">See pricing</Button>
            </Link>
          </div>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TutorialFormat)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="short">Shorts ({shortsCount})</TabsTrigger>
              <TabsTrigger value="full">Full Videos ({fullCount})</TabsTrigger>
            </TabsList>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder={`Search ${tab === "short" ? "shorts" : "full videos"}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value={tab} className="mt-6 space-y-8">
            {isLoading ? (
              <Card className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={16} /> Loading tutorials…
              </Card>
            ) : grouped.length === 0 ? (
              <Card className="p-10 text-center">
                <Sparkles className="mx-auto mb-3 text-primary" />
                <h3 className="text-base font-semibold">
                  {tab === "short" ? "No Shorts yet" : "No Full Videos yet"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {query ? `Nothing matches "${query}".` : "Check back soon."}
                </p>
              </Card>
            ) : (
              grouped.map(([cat, items]) => (
                <section key={cat} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{CATEGORY_LABELS[cat] || cat}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div
                    className={
                      tab === "short"
                        ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                        : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    }
                  >
                    {items.map((t, i) => (
                      <Link
                        key={t.id}
                        to="/academy/$id"
                        params={{ id: t.id }}
                        className="group block overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-md"
                      >
                        <div className={`relative w-full overflow-hidden bg-muted ${tab === "short" ? "aspect-[9/16]" : "aspect-video"}`}>
                          {t.thumbnail_url ? (
                            <img
                              src={t.thumbnail_url}
                              alt={t.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/10">
                              <PlayCircle className="text-primary/60" size={48} />
                            </div>
                          )}
                          <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
                            #{i + 1}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                            <PlayCircle className="text-white" size={56} />
                          </div>
                        </div>
                        <div className="p-3 sm:p-4">
                          <div className="text-sm font-semibold leading-tight line-clamp-2">{t.title}</div>
                          {t.description && tab === "full" && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))
            )}
          </TabsContent>
        </Tabs>

        <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-card p-6 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ready to put what you learned into action?
          </h2>
          <p className="mt-2 max-w-xl mx-auto text-sm sm:text-base text-muted-foreground">
            Create your first video funnel in under 5 minutes. Free to start, no card needed.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/auth?tab=signup">
              <Button variant="hero" size="lg">Sign up free</Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
