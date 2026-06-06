import { createLazyFileRoute } from "@tanstack/react-router";
import PublicAcademyTutorialPage from "@/pages/PublicAcademyTutorialPage";

export const Route = createLazyFileRoute("/academy/$id")({
  component: PublicAcademyTutorialPage,
});
