import { createLazyFileRoute } from "@tanstack/react-router";
import PricingFullPage from "@/pages/PricingFullPage";

export const Route = createLazyFileRoute("/pricing")({
  component: PricingFullPage,
});
