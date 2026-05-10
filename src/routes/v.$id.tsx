import { createFileRoute } from "@tanstack/react-router";
import PublicVideoPage from "@/pages/PublicVideoPage";

export const Route = createFileRoute("/v/$id")({ component: PublicVideoPage });
