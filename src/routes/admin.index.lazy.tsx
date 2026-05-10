import { createLazyFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/pages/AdminDashboard";

export const Route = createLazyFileRoute("/admin/")({
  component: AdminDashboard,
});
