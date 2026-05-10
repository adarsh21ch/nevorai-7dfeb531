import { createFileRoute } from "@tanstack/react-router";
import FunnelEditor from "@/pages/FunnelEditor";

export const Route = createFileRoute("/funnels/$id/edit")({
  component: FunnelEditor,
});
