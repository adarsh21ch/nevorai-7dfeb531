import { createLazyFileRoute } from "@tanstack/react-router";
import VideoDetailPage from "@/pages/VideoDetailPage";

export const Route = createLazyFileRoute("/videos/$id")({
  component: VideoDetailPage,
});
