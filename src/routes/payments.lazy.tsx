import { createLazyFileRoute } from "@tanstack/react-router";
import PaymentsPage from "@/pages/PaymentsPage";

export const Route = createLazyFileRoute("/payments")({
  component: PaymentsPage,
});
