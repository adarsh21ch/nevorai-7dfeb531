import { createLazyFileRoute } from "@tanstack/react-router";
import MemberDashboard from "@/pages/MemberDashboard";
export const Route = createLazyFileRoute("/f/$slug/member")({ component: MemberDashboard });
