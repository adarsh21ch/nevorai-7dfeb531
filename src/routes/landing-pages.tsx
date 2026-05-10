import { createFileRoute } from "@tanstack/react-router";
import LandingPagesPage from "@/pages/LandingPagesPage";

export const Route = createFileRoute("/landing-pages")({
  component: LandingPagesPage,
});
