import { createFileRoute } from "@tanstack/react-router";
import AdminKYCPage from "@/pages/AdminKYCPage";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKYCPage });
