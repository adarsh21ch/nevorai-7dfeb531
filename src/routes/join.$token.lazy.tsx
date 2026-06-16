import { createLazyFileRoute } from "@tanstack/react-router";
import JoinPage from "@/pages/JoinPage";

export const Route = createLazyFileRoute("/join/$token")({
  component: JoinPage,
});
