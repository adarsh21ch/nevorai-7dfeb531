import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/flows/$id")({
  component: Outlet,
});
