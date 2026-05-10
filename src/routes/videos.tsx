import { createFileRoute } from "@tanstack/react-router";
import VideosPage from "@/pages/VideosPage";

export const Route = createFileRoute("/videos")({ component: VideosPage });
