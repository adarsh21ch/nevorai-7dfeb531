import { createLazyFileRoute } from "@tanstack/react-router";
import PrivacyPage from "@/pages/PrivacyPage";

export const Route = createLazyFileRoute("/privacy")({
  component: PrivacyPage,
});
