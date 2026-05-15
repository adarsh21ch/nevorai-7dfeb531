import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Nevorai — YouTube Alternative for Business Videos in India";
const DESCRIPTION =
  "Share business videos that get watched. Real-time tracking, lead capture and an unskippable player — built for Indian coaches, agents and entrepreneurs. Free to start.";
const URL = "https://nevorai.com";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "name": "Nevorai",
              "legalName": "Nevorai Technologies",
              "url": URL,
              "logo": "https://nevorai.com/icons/icon-512x512.png",
              "description":
                "The smarter way to share business videos. Built for Indian coaches, agents and entrepreneurs.",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
                "addressLocality": "Indore",
                "addressRegion": "Madhya Pradesh",
              },
              "founder": { "@type": "Person", "name": "Adarsh" },
              "sameAs": [
                "https://instagram.com/nevoraiflow",
                "https://youtube.com/@nevoraiflow",
              ],
            },
            {
              "@type": "WebSite",
              "name": "Nevorai",
              "url": URL,
              "potentialAction": {
                "@type": "SearchAction",
                "target": `${URL}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "SoftwareApplication",
              "name": "Nevorai",
              "operatingSystem": "Web, iOS, Android",
              "applicationCategory": "BusinessApplication",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "INR",
              },
            },
          ],
        }),
      },
    ],
  }),
});
