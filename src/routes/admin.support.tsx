import { createFileRoute } from "@tanstack/react-router";
import AdminSupportPage from "@/pages/AdminSupportPage";

export const Route = createFileRoute("/admin/support")({ component: AdminSupportPage });
