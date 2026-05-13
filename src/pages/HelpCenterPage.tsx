import { useMemo, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Search, BookOpen, X } from "lucide-react";
import {
  tutorials,
  tutorialCategoryLabels,
  type Tutorial,
  type TutorialCategory,
} from "@/config/tutorials";

export default function HelpCenterPage() {
  useDocumentTitle("Help Center · nFlow by Nevorai");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Tutorial | null>(null);

  const grouped = useMemo(() => {
    const filtered = tutorials.filter((t) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
    const map = new Map<TutorialCategory, Tutorial[]>();
    for (const t of filtered) {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    }
    return Array.from(map.entries());
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <BookOpen className="text-primary" /> Help Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Short videos that show you exactly how to use nFlow by Nevorai. Watch one and you're ready to go.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
        />
        <Input
          placeholder="Search tutorials..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {grouped.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No tutorials match "{query}".
        </Card>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">
                {tutorialCategoryLabels[cat]}
              </h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t)}
                  className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {t.thumbnailUrl ? (
                      <img
                        src={t.thumbnailUrl}
                        alt={t.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <PlayCircle className="text-primary/60" size={48} />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <PlayCircle className="text-white" size={56} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-semibold leading-tight">{t.title}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-3">
              <div className="font-semibold">{active.title}</div>
              <button
                onClick={() => setActive(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={active.videoUrl}
                title={active.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {active.description && (
              <div className="p-4 text-sm text-muted-foreground">
                {active.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
