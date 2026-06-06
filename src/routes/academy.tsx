import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Nevorai Academy — Free video funnel tutorials";
const DESCRIPTION =
  "Free, no-fluff tutorials on building video funnels that convert. For coaches, network marketers and entrepreneurs. No signup required.";
const URL = "https://nevorai.com/academy";

export const Route = createFileRoute("/academy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Nevorai" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
