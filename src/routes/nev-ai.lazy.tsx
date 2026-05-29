import { createLazyFileRoute } from "@tanstack/react-router";
import NevAIPage from "@/pages/NevAIPage";

export const Route = createLazyFileRoute("/nev-ai")({
  component: NevAIPage,
});
