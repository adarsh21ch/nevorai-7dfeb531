import { createLazyFileRoute } from "@tanstack/react-router";
import FunnelDetail from "@/pages/FunnelDetail";

export const Route = createLazyFileRoute("/flows/$id/")({
  component: FunnelDetail,
});