import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://nevorai.com";

type PublicVideoMeta = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  public_url: string | null;
  duration_seconds: number | null;
} | null;

export const Route = createFileRoute("/v/$id")({
  loader: async ({ params }): Promise<{ video: PublicVideoMeta }> => {
    try {
      const { data } = await (supabase as any)
        .from("video_assets")
        .select(
          "id, title, description, thumbnail_url, public_url, duration_seconds, is_shared",
        )
        .eq("id", params.id)
        .eq("is_shared", true)
        .maybeSingle();
      return { video: (data as PublicVideoMeta) ?? null };
    } catch {
      return { video: null };
    }
  },
  head: ({ params, loaderData }) => {
    const v = loaderData?.video;
    const url = `${SITE}/v/${params.id}`;
    if (!v) {
      return {
        meta: [
          { title: "Video — Nevorai" },
          { name: "description", content: "Watch this video on Nevorai." },
          { property: "og:title", content: "Video — Nevorai" },
          { property: "og:description", content: "Watch this video on Nevorai." },
          { property: "og:url", content: url },
          { property: "og:type", content: "video.other" },
          { property: "og:site_name", content: "Nevorai" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }

    const title = `${v.title} — Nevorai`;
    const description =
      v.description?.trim() || `Watch ${v.title} on Nevorai.`;
    const thumb = v.thumbnail_url || undefined;
    const videoUrl = v.public_url || undefined;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: v.title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "video.other" },
      { property: "og:site_name", content: "Nevorai" },
      { name: "twitter:title", content: v.title },
      { name: "twitter:description", content: description },
    ];

    if (thumb) {
      meta.push(
        { property: "og:image", content: thumb },
        { property: "og:image:secure_url", content: thumb },
        { property: "og:image:width", content: "1280" },
        { property: "og:image:height", content: "720" },
        { name: "twitter:image", content: thumb },
      );
    }

    if (videoUrl) {
      meta.push(
        { property: "og:video", content: videoUrl },
        { property: "og:video:secure_url", content: videoUrl },
        { property: "og:video:type", content: "video/mp4" },
        { property: "og:video:width", content: "1280" },
        { property: "og:video:height", content: "720" },
        { name: "twitter:card", content: "player" },
        { name: "twitter:player", content: url },
        { name: "twitter:player:width", content: "1280" },
        { name: "twitter:player:height", content: "720" },
        { name: "twitter:player:stream", content: videoUrl },
        { name: "twitter:player:stream:content_type", content: "video/mp4" },
      );
    } else {
      meta.push({ name: "twitter:card", content: "summary_large_image" });
    }

    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: v.title,
      description,
      uploadDate: new Date().toISOString(),
    };
    if (thumb) jsonLd.thumbnailUrl = thumb;
    if (videoUrl) jsonLd.contentUrl = videoUrl;
    if (v.duration_seconds && v.duration_seconds > 0) {
      jsonLd.duration = `PT${Math.round(v.duration_seconds)}S`;
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
});
