import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://nevorai.com";

type TutorialMeta = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
} | null;

export const Route = createFileRoute("/academy/$id")({
  loader: async ({ params }): Promise<{ tutorial: TutorialMeta }> => {
    try {
      const { data } = await (supabase as any)
        .from("academy_tutorials")
        .select("id,title,description,thumbnail_url,is_published")
        .eq("id", params.id)
        .eq("is_published", true)
        .maybeSingle();
      if (!data) return { tutorial: null };
      return {
        tutorial: {
          id: data.id,
          title: data.title,
          description: data.description ?? null,
          thumbnail_url: data.thumbnail_url ?? null,
        },
      };
    } catch {
      return { tutorial: null };
    }
  },
  head: ({ params, loaderData }) => {
    const t = loaderData?.tutorial;
    const url = `${SITE}/academy/${params.id}`;
    const fallbackTitle = "Tutorial — Nevorai Academy";
    const fallbackDesc =
      "Free video funnel tutorials from Nevorai. Learn to turn videos into leads.";

    if (!t) {
      return {
        meta: [
          { title: fallbackTitle },
          { name: "description", content: fallbackDesc },
          { property: "og:title", content: fallbackTitle },
          { property: "og:description", content: fallbackDesc },
          { property: "og:url", content: url },
          { property: "og:type", content: "video.other" },
          { property: "og:site_name", content: "Nevorai" },
          { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }

    const title = `${t.title} — Nevorai Academy`;
    const description = (t.description?.trim() || fallbackDesc).slice(0, 200);
    const thumb = t.thumbnail_url || undefined;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: t.title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "video.other" },
      { property: "og:site_name", content: "Nevorai" },
      { name: "twitter:title", content: t.title },
      { name: "twitter:description", content: description },
    ];

    if (thumb) {
      meta.push(
        { property: "og:image", content: thumb },
        { property: "og:image:secure_url", content: thumb },
        { property: "og:image:width", content: "1280" },
        { property: "og:image:height", content: "720" },
        { name: "twitter:image", content: thumb },
        { name: "twitter:card", content: "summary_large_image" },
      );
    } else {
      meta.push({ name: "twitter:card", content: "summary" });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
    };
  },
});
