import { createFileRoute } from "@tanstack/react-router";
import AdminVideosPage from "@/pages/AdminVideosPage";

export const Route = createFileRoute("/admin/videos")({ component: AdminVideosPage });
