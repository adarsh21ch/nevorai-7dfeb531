import { Outlet, createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/landing-pages/$id")({
  component: Outlet,
});
