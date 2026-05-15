import { createLazyFileRoute } from "@tanstack/react-router";
import FunnelDetail from "@/pages/FunnelDetail";

export const Route = createLazyFileRoute("/funnels/$id/")({
  component: FunnelDetail,
});