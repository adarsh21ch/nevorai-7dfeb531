import { createLazyFileRoute } from "@tanstack/react-router";
import AdminRevenuePage from "@/pages/AdminRevenuePage";

export const Route = createLazyFileRoute("/admin/revenue")({
  component: AdminRevenuePage,
});
