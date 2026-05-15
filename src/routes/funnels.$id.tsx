import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/funnels/$id")({
  component: Outlet,
});
