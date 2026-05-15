import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/flows/create")({
  beforeLoad: () => {
    throw redirect({ to: "/flows/create" });
  },
});
