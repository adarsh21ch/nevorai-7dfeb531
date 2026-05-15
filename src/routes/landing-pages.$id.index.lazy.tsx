import { createLazyFileRoute } from "@tanstack/react-router";
import LandingPageDetail from "@/pages/LandingPageDetail";

export const Route = createLazyFileRoute("/landing-pages/$id/")({
  component: LandingPageDetail,
});