import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/funnels/")({
  beforeLoad: () => {
    throw redirect({ to: "/flows" });
  },
});
