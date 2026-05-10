import { createFileRoute } from "@tanstack/react-router";
import AdminWhatsAppPage from "@/pages/AdminWhatsAppPage";

export const Route = createFileRoute("/admin/whatsapp")({ component: AdminWhatsAppPage });
