import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://nevorai.com";

type PublicFunnelMeta = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
} | null;

export const Route = createFileRoute("/f/$slug/")({
  loader: async ({ params }): Promise<{ funnel: PublicFunnelMeta }> => {
    try {
      const { data } = await (supabase as any)
        .from("funnels")
        .select("id, slug, title, description, thumbnail_url, is_published, visibility")
        .eq("slug", params.slug)
        .eq("is_published", true)
        .maybeSingle();
      if (!data) return { funnel: null };
      return {
        funnel: {
          id: data.id,
          slug: data.slug,
          title: data.title ?? null,
          description: data.description ?? null,
          thumbnail_url: data.thumbnail_url ?? null,
        },
      };
    } catch {
      return { funnel: null };
    }
  },
  head: ({ params, loaderData }) => {
    const f = loaderData?.funnel;
    const url = `${SITE}/f/${params.slug}`;
    const defaultDesc =
      "Watch on Nevorai — Same effort. Twice the conversion.";

    if (!f) {
      return {
        meta: [
          { title: "Funnel — Nevorai" },
          { name: "description", content: defaultDesc },
          { property: "og:title", content: "Funnel — Nevorai" },
          { property: "og:description", content: defaultDesc },
          { property: "og:url", content: url },
          { property: "og:type", content: "website" },
          { property: "og:site_name", content: "Nevorai" },
          { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }

    const title = f.title ?? "Funnel";
    const description = f.description?.trim() || defaultDesc;
    const thumb = f.thumbnail_url || undefined;

    const meta: Array<Record<string, string>> = [
      { title: `${title} — Nevorai` },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nevorai" },
      { name: "twitter:title", content: title },
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
