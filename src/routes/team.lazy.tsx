import { createLazyFileRoute } from "@tanstack/react-router";
import MyTeamPage from "@/pages/MyTeamPage";

export const Route = createLazyFileRoute("/team")({
  component: MyTeamPage,
});
