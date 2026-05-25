import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Plus, Trash2, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  keywords: string[];
  academy_tutorial_id: string | null;
  media_key: string | null;
  is_published: boolean;
  category: string;
  updated_at: string;
}

interface AcademyTutorial {
  id: string;
  title: string;
  category: string;
}

const CATEGORIES = ["videos", "funnels", "leads", "landing", "live", "billing", "branding", "account", "general"];

export function WhatsAppHelpArticlesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openArticle, setOpenArticle] = useState<HelpArticle | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: articles, isLoading } = useQuery({
    queryKey: ["whatsapp_help_articles"],
    queryFn: async (): Promise<HelpArticle[]> => {
      const { data } = await supabase
        .from("whatsapp_help_articles" as any)
        .select("*")
        .order("category", { ascending: true })
        .order("title", { ascending: true });
      return (data || []) as unknown as HelpArticle[];
    },
  });

  const { data: tutorials } = useQuery({
    queryKey: ["academy_tutorials_lite"],
    queryFn: async (): Promise<AcademyTutorial[]> => {
      const { data } = await supabase
        .from("academy_tutorials" as any)
        .select("id, title, category")
        .eq("is_published", true)
        .order("category");
      return (data || []) as unknown as AcademyTutorial[];
    },
  });

  const filtered = (articles || []).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.toLowerCase().includes(q)) ||
      a.category.toLowerCase().includes(q)
    );
  });

  const grouped = filtered.reduce<Record<string, HelpArticle[]>>((acc, a) => {
    (acc[a.category] ||= []).push(a);
    return acc;
  }, {});

  const newArticle: HelpArticle = {
    id: "",
    slug: "",
    title: "",
    content: "",
    keywords: [],
    academy_tutorial_id: null,
    media_key: null,
    is_published: true,
    category: "general",
    updated_at: "",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Help Articles (Knowledge Base)</h3>
          <p className="text-sm text-muted-foreground">
            The bot uses these to answer "how do I...?" questions with step-by-step text + an optional video.
          </p>
        </div>
        <Button onClick={() => { setOpenArticle(newArticle); setCreating(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New article
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {category}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {items.map((a) => (
              <button
                key={a.id}
                onClick={() => { setOpenArticle(a); setCreating(false); }}
                className="text-left p-3 border rounded hover:bg-muted/50 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-medium text-sm truncate flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                    {a.title}
                  </div>
                  {!a.is_published && (
                    <Badge variant="outline" className="text-[10px] shrink-0">draft</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">{a.content}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {a.keywords.slice(0, 4).map((k) => (
                    <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                  ))}
                  {a.keywords.length > 4 && (
                    <Badge variant="secondary" className="text-[10px]">+{a.keywords.length - 4}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No articles yet. Click "New article" to add one.
          </CardContent>
        </Card>
      )}

      <ArticleEditor
        article={openArticle}
        tutorials={tutorials || []}
        creating={creating}
        onClose={() => setOpenArticle(null)}
        onSaved={() => {
          setOpenArticle(null);
          qc.invalidateQueries({ queryKey: ["whatsapp_help_articles"] });
        }}
      />
    </div>
  );
}

function ArticleEditor({
  article,
  tutorials,
  creating,
  onClose,
  onSaved,
}: {
  article: HelpArticle | null;
  tutorials: AcademyTutorial[];
  creating: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("general");
  const [tutorialId, setTutorialId] = useState<string>("none");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sync state with selected article whenever it changes (or when modal opens)
  useEffect(() => {
    if (!article) return;
    setSlug(article.slug);
    setTitle(article.title);
    setContent(article.content);
    setKeywords(article.keywords.join(", "));
    setCategory(article.category);
    setTutorialId(article.academy_tutorial_id || "none");
    setIsPublished(article.is_published);
  }, [article?.id, creating]);

  // Auto-suggest academy videos based on current keywords + title
  const suggestedTutorials = useMemo(() => {
    if (!tutorials || tutorials.length === 0) return [];
    const tokens = [
      ...title.toLowerCase().split(/\s+/),
      ...keywords.toLowerCase().split(/[\s,]+/),
    ].filter((t) => t.length >= 4);
    if (tokens.length === 0) return tutorials.slice(0, 5);
    const scored = tutorials.map((t) => {
      const titleL = t.title.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (titleL.includes(tok)) score += 2;
      }
      return { t, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score > 0)
      .slice(0, 5)
      .map((s) => s.t);
  }, [tutorials, title, keywords]);

  const handleSave = async () => {
    if (!slug || !title || !content) {
      toast.error("Slug, title, and content are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title: title.trim(),
        content: content.trim(),
        keywords: keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
        category,
        academy_tutorial_id: tutorialId && tutorialId !== "none" ? tutorialId : null,
        is_published: isPublished,
      };

      if (creating) {
        await supabase.from("whatsapp_help_articles" as any).insert(payload);
        toast.success("Article created");
      } else if (article) {
        await supabase
          .from("whatsapp_help_articles" as any)
          .update(payload)
          .eq("id", article.id);
        toast.success("Saved");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!article || creating) return;
    if (!confirm(`Delete "${article.title}"?`)) return;
    try {
      await supabase.from("whatsapp_help_articles" as any).delete().eq("id", article.id);
      toast.success("Deleted");
      onSaved();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  return (
    <Sheet open={!!article} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{creating ? "New article" : "Edit article"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          <div className="space-y-1">
            <Label>Title (shown to user)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to upload a video" />
          </div>

          <div className="space-y-1">
            <Label>Slug (unique URL-style id)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="upload-video"
              disabled={!creating}
            />
          </div>

          <div className="space-y-1">
            <Label>Content (step-by-step instructions)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder={`To upload a video:\n\n1. Click "My Videos" in the sidebar\n2. Tap "Upload" button\n3. Pick your file\n4. Wait for upload to finish`}
            />
            <p className="text-[10px] text-muted-foreground">
              Use numbered steps. Keep it under 1000 characters. WhatsApp shows newlines as line breaks.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Keywords (comma-separated, used for matching)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="upload, video, add video, upload video"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Published</Label>
              <div className="h-9 flex items-center">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 border rounded-md bg-muted/30">
            <Label className="text-sm font-medium">📹 Attach Academy video (optional)</Label>
            <p className="text-xs text-muted-foreground">
              When the bot sends this article, it can also send a linked Nevorai Academy video alongside.
            </p>

            {suggestedTutorials.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Suggested from Academy (based on your keywords):</div>
                <div className="flex flex-wrap gap-1">
                  {suggestedTutorials.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTutorialId(t.id)}
                      className={`text-[11px] px-2 py-1 border rounded transition ${
                        tutorialId === t.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Select value={tutorialId} onValueChange={setTutorialId}>
              <SelectTrigger>
                <SelectValue placeholder="None — text only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — text only</SelectItem>
                {tutorials.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    [{t.category}] {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {creating ? "Create" : "Save"}
            </Button>
            {!creating && (
              <Button variant="outline" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
