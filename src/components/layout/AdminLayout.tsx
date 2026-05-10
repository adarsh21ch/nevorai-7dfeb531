import { Link, useLocation } from "react-router-dom";
import { DashboardLayout } from "./DashboardLayout";
import { LayoutDashboard, Video, Users, UserCheck, CreditCard, Cog, MessageSquare, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const adminTabs = [
  { icon: LayoutDashboard, label: "Overview", path: "/admin" },
  { icon: Video, label: "Videos", path: "/admin/videos" },
  { icon: Users, label: "Users", path: "/admin/users" },
  { icon: UserCheck, label: "KYC", path: "/admin/kyc" },
  { icon: CreditCard, label: "Subs", path: "/admin/subscriptions" },
  { icon: MessageCircle, label: "WhatsApp", path: "/admin/whatsapp" },
  { icon: MessageSquare, label: "Support", path: "/admin/support" },
  { icon: Cog, label: "Settings", path: "/admin/settings" },
];

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  return (
    <DashboardLayout>
      <div className="w-full min-w-0 overflow-hidden">
        {/* Scrollable tab bar — only this row scrolls horizontally */}
        <div className="-mx-3 sm:-mx-4 md:-mx-8 overflow-x-auto scrollbar-none border-b border-border">
          <div className="flex w-max items-center gap-0.5 px-3 sm:px-4 md:px-8">
            {adminTabs.map((tab) => {
              const active = tab.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(tab.path);

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium transition-all sm:px-4 sm:text-sm",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon size={16} className="shrink-0 sm:hidden" />
                  <tab.icon size={18} className="hidden shrink-0 sm:block" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="w-full min-w-0 pt-4 sm:pt-6">
          {children}
        </div>
      </div>
    </DashboardLayout>
  );
};
