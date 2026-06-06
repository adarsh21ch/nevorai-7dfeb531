import { createLazyFileRoute } from "@tanstack/react-router";
import PublicAcademyPage from "@/pages/PublicAcademyPage";

export const Route = createLazyFileRoute("/academy")({
  component: PublicAcademyPage,
});
