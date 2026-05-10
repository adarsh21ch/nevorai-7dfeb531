import { createLazyFileRoute } from "@tanstack/react-router";
import Onboarding from "@/pages/Onboarding";

export const Route = createLazyFileRoute("/onboarding")({
  component: Onboarding,
});
