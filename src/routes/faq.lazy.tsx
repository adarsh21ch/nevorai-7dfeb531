import { createLazyFileRoute } from "@tanstack/react-router";
import FAQPage from "@/pages/FAQPage";

export const Route = createLazyFileRoute("/faq")({
  component: FAQPage,
});
