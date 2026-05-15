import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/flows/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/flows/$id", params: { id: params.id } });
  },
});
