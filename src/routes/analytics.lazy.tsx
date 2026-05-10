import { createLazyFileRoute } from "@tanstack/react-router";
import AnalyticsPage from "@/pages/AnalyticsPage";

export const Route = createLazyFileRoute("/analytics")({
  component: AnalyticsPage,
});
