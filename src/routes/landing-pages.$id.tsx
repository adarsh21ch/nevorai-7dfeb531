import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/landing-pages/$id")({
  component: Outlet,
});
