import { createFileRoute } from "@tanstack/react-router";
import PublicLivePage from "@/pages/PublicLivePage";

export const Route = createFileRoute("/s/$slug")({ component: PublicLivePage });
