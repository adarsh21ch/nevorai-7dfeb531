import { createLazyFileRoute } from "@tanstack/react-router";
import FeaturesPage from "@/pages/FeaturesPage";

export const Route = createLazyFileRoute("/features")({
  component: FeaturesPage,
});
