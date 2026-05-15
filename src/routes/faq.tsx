import { createFileRoute } from "@tanstack/react-router";
import { faqs } from "@/data/faqs";

const TITLE = "Nevorai FAQs — Common Questions Answered";
const DESCRIPTION =
  "Everything you need to know about Nevorai — pricing, features, security, comparisons with YouTube, Vimeo and Google Drive, and how it works for your business.";
const URL = "https://nevorai.com/faq";

export const Route = createFileRoute("/faq")({
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a },
          })),
        }),
      },
    ],
  }),
});
