import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Logo } from "@/components/landing/Logo";
import {
  LayoutDashboard, Layers, Video, IndianRupee, BarChart2,
  User, Bell, LogOut, ChevronLeft, ChevronRight, Shield,
  Radio, FileText, Menu, Crown, HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
// theme handled in ProfilePage
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TrialExpiredGate } from "@/components/TrialExpiredGate";
import { TrialBanner } from "@/components/TrialBanner";
import { usePlan } from "@/hooks/usePlan";
// SupportFAB removed from global mount — moved to Profile page
import { useRouter } from "@tanstack/react-router";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Video, label: "My Videos", path: "/videos" },
  { icon: BarChart2, label: "Insights", path: "/leads" },
  { icon: Layers, label: "My Funnels", path: "/funnels" },
  { icon: FileText, label: "Landing Pages", path: "/landing-pages" },
  { icon: Radio, label: "Live", path: "/live" },
  { icon: Crown, label: "Upgrade to Pro", path: "/billing" },
  { icon: IndianRupee, label: "Payments", path: "/payments" },
];

const bottomItems = [
  { icon: HelpCircle, label: "Help Center", path: "/help" },
  { icon: User, label: "Profile", path: "/profile" },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // theme toggle moved to Profile page
  const { isTrialExpired, trialDays } = useTrialStatus();
  const { plan } = usePlan();
  const isAdminUser = isAdmin;
  const showTrialGate = isTrialExpired && !plan.isPaid && !isAdminUser && !location.pathname.startsWith("/pricing") && !location.pathname.startsWith("/billing") && !location.pathname.startsWith("/admin");

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const preloadRoute = (path: string) => {
    void router.preloadRoute({ to: path as any });
  };

  const renderNavItem = (item: typeof navItems[0], matchExact = false) => {
    const active = matchExact ? location.pathname === item.path : location.pathname.startsWith(item.path);
    const isNotif = item.path === "/notifications";
    return (
      <Link
        key={item.path}
        to={item.path}
        onMouseEnter={() => preloadRoute(item.path)}
        onFocus={() => preloadRoute(item.path)}
        className={cn(
          "relative flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-all",
          active
            ? "border-primary bg-primary/10 text-primary"
            : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon size={18} />
        {!collapsed && <span>{item.label}</span>}
        {isNotif && unreadCount > 0 && (
          <span className={cn(
            "flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground",
            collapsed ? "absolute -right-1 -top-1 h-4 w-4" : "ml-auto h-5 w-5"
          )}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  const renderMobileNavItem = (item: typeof navItems[0]) => {
    const active = location.pathname.startsWith(item.path);
    const isNotif = item.path === "/notifications";
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setMobileMenuOpen(false)}
        onMouseEnter={() => preloadRoute(item.path)}
        onFocus={() => preloadRoute(item.path)}
        className={cn(
          "relative flex min-h-[46px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
          active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
        )}
      >
        <item.icon size={20} />
        <span>{item.label}</span>
        {isNotif && unreadCount > 0 && (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="h-screen w-full max-w-full overflow-hidden bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex h-full w-full max-w-full overflow-hidden">
        <aside className={cn(
          "hidden h-full flex-col border-r border-border bg-sidebar transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-60"
        )}>
          <div className="h-0.5 w-full bg-gradient-brand-rich" style={{ marginTop: 'env(safe-area-inset-top)' }} />
          <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
            {!collapsed && <Logo size="sm" showByline />}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
            {navItems.map((item) => renderNavItem(item))}
            {isAdmin && (
              <div className="px-3 pb-2 pt-4">
                <Link
                  to="/admin"
                    onMouseEnter={() => preloadRoute("/admin")}
                    onFocus={() => preloadRoute("/admin")}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    location.pathname.startsWith("/admin")
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Shield size={18} />
                  {!collapsed && <span>Admin Panel</span>}
                </Link>
              </div>
            )}
          </nav>

          <div className="shrink-0 space-y-1 border-t border-border px-2 py-4">
            {bottomItems.map((item) => renderNavItem(item))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
            >
              <LogOut size={18} />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <Logo size="sm" showByline />
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1.5">
                <Link
                  to="/notifications"
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Menu size={20} />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[85vw] max-w-72 p-0">
                    <div className="border-b border-border p-4">
                      <Logo size="sm" showByline />
                    </div>
                    <nav className="max-h-[calc(100vh-160px)] space-y-0.5 overflow-y-auto px-2 py-2">
                      <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Main</p>
                      {navItems.map(renderMobileNavItem)}
                      <div className="my-2 border-t border-border" />
                      <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
                      {bottomItems.map(renderMobileNavItem)}
                      {isAdmin && (
                        <>
                          <div className="my-2 border-t border-border" />
                          <Link
                            to="/admin"
                            onClick={() => setMobileMenuOpen(false)}
                            onMouseEnter={() => preloadRoute("/admin")}
                            onFocus={() => preloadRoute("/admin")}
                            className={cn(
                              "flex min-h-[46px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                              location.pathname.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                            )}
                          >
                            <Shield size={20} />
                            <span>Admin Panel</span>
                          </Link>
                        </>
                      )}
                    </nav>
                    <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-3">
                      <button
                        onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
                      >
                        <LogOut size={18} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>

          <TrialBanner />
          <div className="gradient-bg-subtle flex-1 overflow-x-hidden overflow-y-auto px-3 pb-24 pt-3 sm:px-4 sm:pb-8 sm:pt-4 md:p-8">
            <div className="w-full min-w-0 max-w-full">{children}</div>
          </div>
        </main>
        {showTrialGate && <TrialExpiredGate trialDays={trialDays} />}

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden safe-area-pb">
          <div className="grid grid-cols-5 items-end">
            {[
              { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
              { icon: Video, label: "My Videos", path: "/videos" },
              { icon: Users, label: "My Leads", path: "/leads" },
              { icon: Layers, label: "Funnels", path: "/funnels" },
              { icon: User, label: "Profile", path: "/profile" },
            ].map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={() => preloadRoute(item.path)}
                  className={cn(
                    "flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};
