import { createFileRoute } from "@tanstack/react-router";
import FunnelsPage from "@/pages/FunnelsPage";

export const Route = createFileRoute("/funnels")({
  component: FunnelsPage,
});
