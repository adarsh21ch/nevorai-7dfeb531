import { createFileRoute } from "@tanstack/react-router";
import PublicFunnel from "@/pages/PublicFunnel";

export const Route = createFileRoute("/f/$slug")({
  component: PublicFunnel,
});
