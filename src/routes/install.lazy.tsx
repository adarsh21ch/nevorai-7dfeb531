import { createLazyFileRoute } from "@tanstack/react-router";
import InstallApp from "@/pages/InstallApp";

export const Route = createLazyFileRoute("/install")({
  component: InstallApp,
});
