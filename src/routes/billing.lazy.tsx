import { createLazyFileRoute } from "@tanstack/react-router";
import BillingPage from "@/pages/BillingPage";

export const Route = createLazyFileRoute("/billing")({
  component: BillingPage,
});
