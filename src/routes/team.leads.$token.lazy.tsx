import { createLazyFileRoute } from "@tanstack/react-router";
import SharedTeamLeadsPage from "@/pages/SharedTeamLeadsPage";

export const Route = createLazyFileRoute("/team/leads/$token")({
  component: SharedTeamLeadsPage,
});
