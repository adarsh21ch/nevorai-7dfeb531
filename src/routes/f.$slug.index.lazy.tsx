import { createLazyFileRoute } from "@tanstack/react-router";
import PublicFunnel from "@/pages/PublicFunnel";

export const Route = createLazyFileRoute("/f/$slug/")({
  component: PublicFunnel,
});
