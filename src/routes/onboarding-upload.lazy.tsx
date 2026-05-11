import { createLazyFileRoute } from "@tanstack/react-router";
import UploadFirstOnboarding from "@/pages/UploadFirstOnboarding";

export const Route = createLazyFileRoute("/onboarding-upload")({
  component: UploadFirstOnboarding,
});
