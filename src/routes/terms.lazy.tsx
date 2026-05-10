import { createLazyFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/TermsPage";

export const Route = createLazyFileRoute("/terms")({
  component: TermsPage,
});
