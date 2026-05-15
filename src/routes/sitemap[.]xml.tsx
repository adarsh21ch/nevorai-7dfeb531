import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://nevorai.com";
const MAX_URLS = 50_000;

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/pricing", priority: "0.9", changefreq: "monthly" },
  { path: "/features", priority: "0.9", changefreq: "monthly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/faq", priority: "0.7", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
  { path: "/use-cases/network-marketing", priority: "0.8", changefreq: "monthly" },
  { path: "/use-cases/insurance-agents", priority: "0.8", changefreq: "monthly" },
  { path: "/use-cases/coaches", priority: "0.8", changefreq: "monthly" },
  { path: "/use-cases/real-estate", priority: "0.8", changefreq: "monthly" },
  { path: "/compare/nevorai-vs-youtube", priority: "0.8", changefreq: "monthly" },
  { path: "/compare/nevorai-vs-vimeo", priority: "0.7", changefreq: "monthly" },
  { path: "/compare/nevorai-vs-google-drive", priority: "0.7", changefreq: "monthly" },
  { path: "/privacy", priority: "0.4", changefreq: "yearly" },
  { path: "/terms", priority: "0.4", changefreq: "yearly" },
  { path: "/refund-policy", priority: "0.4", changefreq: "yearly" },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(value: string | null | undefined): string {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

interface Entry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

async function buildEntries(): Promise<Entry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const entries: Entry[] = STATIC_PAGES.map((p) => ({
    loc: `${BASE_URL}${p.path}`,
    lastmod: today,
    changefreq: p.changefreq,
    priority: p.priority,
  }));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return entries;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase
      .from("funnels")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(20_000);
    if (error) console.error("sitemap flows error", error);
    for (const row of data ?? []) {
      if (!row.slug) continue;
      entries.push({
        loc: `${BASE_URL}/f/${escapeXml(row.slug)}`,
        lastmod: formatDate(row.updated_at),
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } catch (e) {
    console.error("sitemap flows exception", e);
  }

  try {
    const { data, error } = await supabase
      .from("landing_pages")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(20_000);
    if (error) console.error("sitemap landing_pages error", error);
    for (const row of data ?? []) {
      if (!row.slug) continue;
      entries.push({
        loc: `${BASE_URL}/l/${escapeXml(row.slug)}`,
        lastmod: formatDate(row.updated_at),
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } catch (e) {
    console.error("sitemap landing_pages exception", e);
  }

  try {
    const { data, error } = await supabase
      .from("video_assets")
      .select("id, updated_at")
      .eq("status", "ready")
      .eq("is_shared", true)
      .order("updated_at", { ascending: false })
      .limit(20_000);
    if (error) console.error("sitemap video_assets error", error);
    for (const row of data ?? []) {
      if (!row.id) continue;
      entries.push({
        loc: `${BASE_URL}/v/${escapeXml(row.id)}`,
        lastmod: formatDate(row.updated_at),
        changefreq: "monthly",
        priority: "0.5",
      });
    }
  } catch (e) {
    console.error("sitemap video_assets exception", e);
  }

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("live_sessions")
      .select("slug, updated_at")
      .eq("is_published", true)
      .gte("scheduled_at", since)
      .order("updated_at", { ascending: false })
      .limit(20_000);
    if (error) console.error("sitemap live_sessions error", error);
    for (const row of data ?? []) {
      if (!row.slug) continue;
      entries.push({
        loc: `${BASE_URL}/s/${escapeXml(row.slug)}`,
        lastmod: formatDate(row.updated_at),
        changefreq: "daily",
        priority: "0.5",
      });
    }
  } catch (e) {
    console.error("sitemap live_sessions exception", e);
  }

  return entries.slice(0, MAX_URLS);
}

function renderXml(entries: Entry[]): string {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = await buildEntries();
        return new Response(renderXml(entries), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
