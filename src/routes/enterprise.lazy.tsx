import { createLazyFileRoute } from "@tanstack/react-router";
import EnterpriseInquiryPage from "@/pages/EnterpriseInquiryPage";

export const Route = createLazyFileRoute("/enterprise")({
  component: EnterpriseInquiryPage,
});
