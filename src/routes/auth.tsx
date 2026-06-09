import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    email: z.string().optional(),
    redirect: z.string().optional(),
    plan: z.string().optional(),
  }),
});
