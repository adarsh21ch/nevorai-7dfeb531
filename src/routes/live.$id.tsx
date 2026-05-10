import { createFileRoute } from "@tanstack/react-router";
import LiveDetailPage from "@/pages/LiveDetailPage";

export const Route = createFileRoute("/live/$id")({ component: LiveDetailPage });
