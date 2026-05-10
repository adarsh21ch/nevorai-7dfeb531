import { createFileRoute } from "@tanstack/react-router";
import LivePage from "@/pages/LivePage";

export const Route = createFileRoute("/live")({ component: LivePage });
