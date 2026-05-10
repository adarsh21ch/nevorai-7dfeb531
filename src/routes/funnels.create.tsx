import { createFileRoute } from "@tanstack/react-router";
import FunnelEditor from "@/pages/FunnelEditor";

export const Route = createFileRoute("/funnels/create")({
  component: FunnelEditor,
});
