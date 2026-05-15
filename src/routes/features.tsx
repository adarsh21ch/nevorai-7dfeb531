import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Nevorai Features — Unskippable Video, Lead Capture, Real-Time Tracking";
const DESCRIPTION =
  "Unskippable video player, real-time viewer activity, lead capture forms, video funnels, scheduled live sessions, WhatsApp share previews. Built for Indian business.";
const URL = "https://nevorai.com/features";

export const Route = createFileRoute("/features")({
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
