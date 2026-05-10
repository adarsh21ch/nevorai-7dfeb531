import { createLazyFileRoute } from "@tanstack/react-router";
import RefundPolicyPage from "@/pages/RefundPolicyPage";

export const Route = createLazyFileRoute("/refund-policy")({
  component: RefundPolicyPage,
});
