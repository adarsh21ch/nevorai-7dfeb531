import { createFileRoute } from "@tanstack/react-router";
import FunnelDetail from "@/pages/FunnelDetail";

export const Route = createFileRoute("/funnels/$id")({
  component: FunnelDetail,
});
