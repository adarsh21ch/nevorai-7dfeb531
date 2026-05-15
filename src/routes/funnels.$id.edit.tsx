import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/funnels/$id/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/flows/$id/edit", params: { id: params.id } });
  },
});
