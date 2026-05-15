import { createFileRoute } from "@tanstack/react-router";

const TITLE = "About Nevorai — Made in India for Indian Business Owners";
const DESCRIPTION =
  "Built by Adarsh in Indore, Madhya Pradesh. Nevorai is the smarter way for coaches, network marketers, insurance agents and entrepreneurs to share business videos.";
const URL = "https://nevorai.com/about";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});
