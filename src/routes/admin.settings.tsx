import { createFileRoute } from "@tanstack/react-router";
import AdminSettingsPage from "@/pages/AdminSettingsPage";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettingsPage });
