import { createFileRoute } from "@tanstack/react-router";
import PublicLandingPage from "@/pages/PublicLandingPage";

export const Route = createFileRoute("/l/$slug")({
  component: PublicLandingPage,
});
