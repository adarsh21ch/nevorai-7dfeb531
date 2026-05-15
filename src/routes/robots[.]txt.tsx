import { createFileRoute } from "@tanstack/react-router";

const ROBOTS = `User-agent: *
Allow: /

# Disallow admin and authenticated areas
Disallow: /admin
Disallow: /admin/
Disallow: /dashboard
Disallow: /profile
Disallow: /videos
Disallow: /tools
Disallow: /insights
Disallow: /billing
Disallow: /settings
Disallow: /notifications
Disallow: /kyc
Disallow: /onboarding
Disallow: /auth
Disallow: /checkout
Disallow: /api/

# Sitemap location
Sitemap: https://nevorai.com/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(ROBOTS, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        }),
    },
  },
});
