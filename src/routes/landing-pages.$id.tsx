import { createFileRoute } from "@tanstack/react-router";
import LandingPageDetail from "@/pages/LandingPageDetail";

export const Route = createFileRoute("/landing-pages/$id")({
  component: LandingPageDetail,
});
