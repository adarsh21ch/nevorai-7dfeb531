import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/funnels/create")({
  beforeLoad: () => {
    throw redirect({ to: "/flows/create" });
  },
});
