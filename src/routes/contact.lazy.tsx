import { createLazyFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/ContactPage";

export const Route = createLazyFileRoute("/contact")({
  component: ContactPage,
});
