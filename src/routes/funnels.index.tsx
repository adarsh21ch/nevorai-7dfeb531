import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/flows/")({
  beforeLoad: () => {
    throw redirect({ to: "/flows" });
  },
});
