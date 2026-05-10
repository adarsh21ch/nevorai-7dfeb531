import { createLazyFileRoute } from "@tanstack/react-router";
import CheckoutReturn from "@/pages/CheckoutReturn";
export const Route = createLazyFileRoute("/checkout/return")({ component: CheckoutReturn });
