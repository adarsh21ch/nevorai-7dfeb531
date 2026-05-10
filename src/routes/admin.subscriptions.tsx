import { createFileRoute } from "@tanstack/react-router";
import AdminSubscriptionsPage from "@/pages/AdminSubscriptionsPage";

export const Route = createFileRoute("/admin/subscriptions")({ component: AdminSubscriptionsPage });
