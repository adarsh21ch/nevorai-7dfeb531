import { Link, useParams } from "@/lib/router-compat";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ChevronLeft, Loader2, PlayCircle, Sparkles } from "lucide-react";
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

const isEmbedUrl = (url: string) =>
  /youtube\.com\/embed|player\.vimeo\.com|youtu\.be\/embed/.test(url);

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
        .select("id,title,description,video_url,thumbnail_url,category,order_index,is_published")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as Tutorial | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: related = [] } = useQuery({
    queryKey: ["academy-related", tutorial?.category, tutorial?.id],
    enabled: !!tutorial,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,thumbnail_url,order_index")
        .eq("is_published", true)
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
    mutationFn: async (done: boolean) => {
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
    onSuccess: (_d, done) => {
      qc.invalidateQueries({ queryKey: ["academy-completion", user?.id, id] });
      toast.success(done ? "Marked as completed" : "Marked as not completed");
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
                  src={tutorial.video_url}
                  controls
                  playsInline
                  poster={tutorial.thumbnail_url || undefined}
                  className="h-full w-full"
                  onEnded={() => {
                    if (user && !isCompleted) toggleComplete.mutate(true);
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
                  onClick={() => toggleComplete.mutate(!isCompleted)}
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
                <h3 className="font-semibold mb-3 text-sm">More in this series</h3>
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
