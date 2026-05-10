import { createFileRoute } from "@tanstack/react-router";
import LandingPageEditor from "@/pages/LandingPageEditor";

export const Route = createFileRoute("/landing-pages/create")({
  component: LandingPageEditor,
});
