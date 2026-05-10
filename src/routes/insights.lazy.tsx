import { createLazyFileRoute } from "@tanstack/react-router";
import InsightsPage from "@/pages/InsightsPage";

export const Route = createLazyFileRoute("/insights")({
  component: InsightsPage,
});
