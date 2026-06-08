import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "@/lib/router-compat";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ChevronLeft, Loader2, PlayCircle, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

const isEmbedUrl = (url: string) =>
  /youtube\.com\/embed|player\.vimeo\.com|youtu\.be\/embed/.test(url);

const normalizeFormat = (f: any): TutorialFormat => (f === "full" ? "full" : "short");

export default function PublicAcademyTutorialPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tutorial, isLoading } = useQuery({
    queryKey: ["academy-tutorial", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,description,video_url,thumbnail_url,category,order_index,is_published,format")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, format: normalizeFormat(data.format) } as Tutorial;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isShort = tutorial?.format === "short";

  // For Shorts: load all shorts (across categories) for reels-style navigation.
  const { data: shortsFeed = [] } = useQuery({
    queryKey: ["academy-shorts-feed"],
    enabled: !!tutorial && isShort,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,description,video_url,thumbnail_url,category,order_index,is_published,format")
        .eq("is_published", true)
        .eq("format", "short")
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      return ((data || []) as Tutorial[]).map((t) => ({ ...t, format: normalizeFormat(t.format) }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // For Full Videos: related videos in same category.
  const { data: related = [] } = useQuery({
    queryKey: ["academy-related-full", tutorial?.category, tutorial?.id],
    enabled: !!tutorial && !isShort,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,thumbnail_url,order_index,format")
        .eq("is_published", true)
        .eq("format", "full")
        .eq("category", tutorial!.category)
        .neq("id", tutorial!.id)
        .order("order_index", { ascending: true })
        .limit(6);
      return (data || []) as Array<Pick<Tutorial, "id" | "title" | "thumbnail_url" | "order_index">>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: isCompleted = false } = useQuery({
    queryKey: ["academy-completion", user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_completions")
        .select("tutorial_id")
        .eq("user_id", user!.id)
        .eq("tutorial_id", id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ tutorialId, done }: { tutorialId: string; done: boolean }) => {
      if (!user) throw new Error("Sign in required");
      if (done) {
        const { error } = await (supabase as any)
          .from("academy_completions")
          .insert({ user_id: user.id, tutorial_id: tutorialId });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("academy_completions")
          .delete()
          .eq("user_id", user.id)
          .eq("tutorial_id", tutorialId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["academy-completion", user?.id, vars.tutorialId] });
      toast.success(vars.done ? "Marked as completed" : "Marked as not completed");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container-app py-16 flex items-center justify-center text-muted-foreground">
          <Loader2 className="animate-spin mr-2" size={18} /> Loading…
        </main>
        <Footer />
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container-app py-16">
          <Card className="p-10 text-center">
            <Sparkles className="mx-auto mb-3 text-primary" />
            <h1 className="text-xl font-semibold">Tutorial not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been unpublished. Browse all tutorials in the Academy.
            </p>
            <div className="mt-5">
              <Link to="/academy"><Button variant="hero">Back to Academy</Button></Link>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (isShort) {
    return (
      <ShortsPlayer
        current={tutorial}
        feed={shortsFeed.length > 0 ? shortsFeed : [tutorial]}
        user={user}
        isCompleted={isCompleted}
        onToggleComplete={(tid, done) => toggleComplete.mutate({ tutorialId: tid, done })}
      />
    );
  }

  // FULL VIDEO PLAYER
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container-app py-6 sm:py-10 space-y-8">
        <Link to="/academy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={16} /> Back to Academy
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
              {isEmbedUrl(tutorial.video_url) ? (
                <iframe
                  src={tutorial.video_url}
                  title={tutorial.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  key={tutorial.id}
                  src={tutorial.video_url}
                  controls
                  playsInline
                  preload="metadata"
                  poster={tutorial.thumbnail_url || undefined}
                  className="h-full w-full object-contain"
                  onEnded={() => {
                    if (user && !isCompleted) toggleComplete.mutate({ tutorialId: tutorial.id, done: true });
                  }}
                />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{tutorial.title}</h1>
              {tutorial.description && (
                <p className="mt-2 text-sm sm:text-base text-muted-foreground">{tutorial.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              {user ? (
                <Button
                  variant={isCompleted ? "outline" : "hero"}
                  disabled={toggleComplete.isPending}
                  onClick={() => toggleComplete.mutate({ tutorialId: tutorial.id, done: !isCompleted })}
                >
                  {isCompleted ? (
                    <><CheckCircle2 size={16} className="text-green-500" /> Completed</>
                  ) : (
                    <><Circle size={16} /> Mark as complete</>
                  )}
                </Button>
              ) : (
                <Link to="/auth?tab=signup">
                  <Button variant="hero">Sign up to track progress</Button>
                </Link>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <Card className="p-5 bg-gradient-to-br from-primary/10 to-card border-primary/30">
              <h3 className="text-lg font-bold">Ready to build your funnel?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try Nevorai free. Turn any video into a lead-capturing funnel in minutes.
              </p>
              <Link to="/auth?tab=signup" className="block mt-3">
                <Button variant="hero" className="w-full">Sign up free</Button>
              </Link>
            </Card>

            {related.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 text-sm">More desktop tutorials in this series</h3>
                <ul className="space-y-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/academy/$id"
                        params={{ id: r.id }}
                        className="flex gap-3 items-center rounded-md p-1.5 hover:bg-muted"
                      >
                        <div className="w-20 aspect-video rounded bg-muted overflow-hidden flex-shrink-0">
                          {r.thumbnail_url ? (
                            <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><PlayCircle size={18} className="text-muted-foreground" /></div>
                          )}
                        </div>
                        <div className="text-xs font-medium line-clamp-2">{r.title}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Shorts (reels-style) player ---------- */

function ShortsPlayer({
  current,
  feed,
  user,
  isCompleted,
  onToggleComplete,
}: {
  current: Tutorial;
  feed: Tutorial[];
  user: any;
  isCompleted: boolean;
  onToggleComplete: (tutorialId: string, done: boolean) => void;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const startIndex = useMemo(() => {
    const i = feed.findIndex((t) => t.id === current.id);
    return i >= 0 ? i : 0;
  }, [feed, current.id]);

  const [activeIndex, setActiveIndex] = useState(startIndex);

  // Scroll to the current short on mount / when id changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const slide = el.children[startIndex] as HTMLElement | undefined;
    if (slide) {
      el.scrollTo({ top: slide.offsetTop, behavior: "auto" });
    }
  }, [startIndex]);

  // Use IntersectionObserver to track active slide → autoplay only the active video.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the most visible entry.
        let bestIdx = -1;
        let bestRatio = 0;
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestIdx = slides.indexOf(e.target as HTMLElement);
          }
        }
        if (bestIdx >= 0 && bestRatio > 0.6) {
          setActiveIndex((prev) => (prev === bestIdx ? prev : bestIdx));
        }
      },
      { root: el, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );

    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [feed]);

  // Drive playback based on activeIndex.
  useEffect(() => {
    feed.forEach((t, i) => {
      const v = videoRefs.current.get(t.id);
      if (!v) return;
      if (i === activeIndex) {
        v.muted = false;
        v.play().catch(() => {
          // Autoplay may require muted; fall back.
          v.muted = true;
          v.play().catch(() => {});
        });
      } else {
        v.pause();
        try { v.currentTime = 0; } catch {}
      }
    });

    // Sync URL to active short so deep links match.
    const active = feed[activeIndex];
    if (active && active.id !== current.id) {
      try {
        window.history.replaceState(null, "", `/academy/${active.id}`);
      } catch {}
    }
  }, [activeIndex, feed, current.id]);

  const goTo = (dir: "up" | "down") => {
    const el = containerRef.current;
    if (!el) return;
    const target = dir === "down" ? activeIndex + 1 : activeIndex - 1;
    if (target < 0 || target >= feed.length) return;
    const slide = el.children[target] as HTMLElement | undefined;
    if (slide) el.scrollTo({ top: slide.offsetTop, behavior: "smooth" });
  };

  const activeTutorial = feed[activeIndex] ?? current;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-3 sm:px-5">
        <button
          onClick={() => navigate("/academy")}
          className="inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-sm backdrop-blur-sm hover:bg-black/60"
        >
          <ChevronLeft size={16} /> Academy
        </button>
        <div className="rounded-full bg-black/40 px-3 py-1 text-xs backdrop-blur-sm">
          Shorts · {activeIndex + 1}/{feed.length}
        </div>
      </div>

      {/* Up / Down controls (desktop) */}
      <div className="pointer-events-none absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
        <button
          onClick={() => goTo("up")}
          disabled={activeIndex === 0}
          className="pointer-events-auto rounded-full bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-30"
          aria-label="Previous short"
        >
          <ChevronUp size={20} />
        </button>
        <button
          onClick={() => goTo("down")}
          disabled={activeIndex === feed.length - 1}
          className="pointer-events-auto rounded-full bg-white/10 p-3 backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-30"
          aria-label="Next short"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Vertical paged feed (CSS scroll-snap = native touch swipe) */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
        style={{ scrollbarWidth: "none" }}
      >
        {feed.map((t, i) => (
          <ShortSlide
            key={t.id}
            tutorial={t}
            isActive={i === activeIndex}
            registerVideo={(el) => {
              if (el) videoRefs.current.set(t.id, el);
              else videoRefs.current.delete(t.id);
            }}
            user={user}
            isCompleted={i === activeIndex ? isCompleted : false}
            onComplete={(done) => onToggleComplete(t.id, done)}
          />
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-5 pt-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold sm:text-lg">{activeTutorial.title}</h2>
            {activeTutorial.description && (
              <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">{activeTutorial.description}</p>
            )}
          </div>
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {user ? (
              <Button
                variant={isCompleted && activeTutorial.id === current.id ? "outline" : "hero"}
                size="sm"
                onClick={() => onToggleComplete(activeTutorial.id, !(isCompleted && activeTutorial.id === current.id))}
              >
                {isCompleted && activeTutorial.id === current.id ? (
                  <><CheckCircle2 size={14} className="text-green-500" /> Completed</>
                ) : (
                  <><Circle size={14} /> Mark complete</>
                )}
              </Button>
            ) : (
              <Link to="/auth?tab=signup">
                <Button variant="hero" size="sm">Sign up free</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortSlide({
  tutorial,
  isActive,
  registerVideo,
  user,
  isCompleted,
  onComplete,
}: {
  tutorial: Tutorial;
  isActive: boolean;
  registerVideo: (el: HTMLVideoElement | null) => void;
  user: any;
  isCompleted: boolean;
  onComplete: (done: boolean) => void;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);

  return (
    <section className="snap-start snap-always relative flex h-[100dvh] w-full items-center justify-center bg-black">
      {isEmbedUrl(tutorial.video_url) ? (
        <iframe
          src={tutorial.video_url}
          title={tutorial.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video
          ref={(el) => {
            localRef.current = el;
            registerVideo(el);
          }}
          src={tutorial.video_url}
          poster={tutorial.thumbnail_url || undefined}
          className="h-full max-h-full w-full object-contain"
          playsInline
          loop
          preload={isActive ? "auto" : "metadata"}
          onClick={() => {
            const v = localRef.current;
            if (!v) return;
            if (v.paused) v.play().catch(() => {});
            else v.pause();
          }}
          onEnded={() => {
            if (user && isActive && !isCompleted) onComplete(true);
          }}
        />
      )}
    </section>
  );
}
