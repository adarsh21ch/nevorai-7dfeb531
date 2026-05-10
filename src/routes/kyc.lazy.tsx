import { createLazyFileRoute } from "@tanstack/react-router";
import KYCPage from "@/pages/KYCPage";

export const Route = createLazyFileRoute("/kyc")({
  component: KYCPage,
});
