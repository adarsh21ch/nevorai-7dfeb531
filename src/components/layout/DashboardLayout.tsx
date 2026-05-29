import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Link as TLink } from "@tanstack/react-router";
import { Logo } from "@/components/landing/Logo";
import {
  LayoutDashboard, Layers, Video, IndianRupee, BarChart2,
  User, LogOut, ChevronLeft, ChevronRight, Shield,
  Radio, FileText, Crown, GraduationCap, Home, Wrench, Activity,
  GitBranch, Layout, Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
// theme handled in ProfilePage
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TrialExpiredGate } from "@/components/TrialExpiredGate";
import { TrialBanner } from "@/components/TrialBanner";
import { usePlan } from "@/hooks/usePlan";
import { usePlanLimits } from "@/hooks/usePlanLimits";
// SupportFAB removed from global mount — moved to Profile page
import { useRouter } from "@tanstack/react-router";

const baseNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Sparkles, label: "Nev AI", path: "/nev-ai" },
  { icon: Video, label: "My Videos", path: "/videos" },
  { icon: Activity, label: "Activity", path: "/insights" },
  { icon: Layers, label: "Tools", path: "/tools" },
];
const tailNavItems = [
  { icon: Crown, label: "Upgrade to Pro", path: "/billing" },
  { icon: IndianRupee, label: "Payments", path: "/payments" },
];

const bottomItems = [
  { icon: GraduationCap, label: "Nevorai Academy", path: "/help" },
  { icon: User, label: "Profile", path: "/profile" },
];

export const DashboardLayout = ({ children, editorMode = false }: { children: React.ReactNode; editorMode?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const { signOut, user, profile, loading: authLoading } = useAuth();

  // WhatsApp verification is OPTIONAL (temporary hotfix while OTP delivery
  // is unreliable). Users can still verify via Settings → WhatsApp.


  const { isAdmin } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  // theme toggle moved to Profile page
  const { isTrialExpired, trialDays } = useTrialStatus();
  const { plan } = usePlan();
  const { features } = usePlanLimits();
  const navItems = [
    ...baseNavItems,
    ...tailNavItems,
  ];
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const preloadRoute = (path: string) => {
    void router.preloadRoute({ to: path as any });
  };

  // Proactive 12-route preload removed — defaultPreload: "intent" preloads
  // on hover/focus which is sufficient and avoids hammering the network.


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
            ? "bg-muted text-foreground font-semibold"
            : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
        style={active ? { borderLeftColor: "var(--accent-saffron)" } : undefined}
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

  return (
    <div className="h-screen w-full max-w-full overflow-hidden bg-background">
      <div className="flex h-full w-full max-w-full overflow-hidden">
        <aside className={cn(
          "hidden h-full flex-col border-r border-border bg-sidebar transition-all duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}>
          <div className="h-0.5 w-full bg-gradient-brand-rich" style={{ marginTop: 'env(safe-area-inset-top)' }} />
          <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
            {!collapsed && <Logo size="sm" showByline />}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
            {navItems.map((item) => {
              if (item.path === "/tools") {
                const onTools = location.pathname.startsWith("/tools");
                const search = location.search || (typeof window !== "undefined" ? window.location.search : "");
                const activeTab = onTools ? (new URLSearchParams(search).get("tab") || "funnels") : null;
                const subItems = [
                  { key: "funnels", label: "Funnels", icon: GitBranch },
                  ...(features.landingPages ? [{ key: "landing-pages", label: "Landing Pages", icon: Layout }] : []),
                  ...(features.goLive ? [{ key: "live", label: "Live", icon: Radio }] : []),
                ];
                return (
                  <div key={item.path}>
                    {renderNavItem(item)}
                    {!collapsed && onTools && (
                      <div className="ml-6 mt-1 space-y-0.5 border-l border-border pl-2">
                        {subItems.map((sub) => {
                          const subActive = activeTab === sub.key;
                          return (
                            <Link
                              key={sub.key}
                              to={`/tools?tab=${sub.key}`}
                              onMouseEnter={() => preloadRoute("/tools")}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                                subActive
                                  ? "bg-muted text-foreground font-semibold"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              )}
                              style={subActive ? { color: "var(--accent-saffron)" } : undefined}
                            >
                              <sub.icon size={14} />
                              <span>{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              return renderNavItem(item);
            })}
            {isAdmin && (
              <div className="px-3 pb-2 pt-4">
                <Link
                  to="/admin"
                    onMouseEnter={() => preloadRoute("/admin")}
                    onFocus={() => preloadRoute("/admin")}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    location.pathname.startsWith("/admin")
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
          {!editorMode && (
            <div className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-sm lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 pt-[5px]">
                <div className="min-w-0 flex-1">
                  <Logo size="sm" showByline />
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  <Link
                    to="/help"
                    aria-label="Nevorai Academy"
                    className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--accent-saffron) 30%, transparent)" }}
                  >
                    <GraduationCap size={20} />
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-background"
                      style={{ background: "var(--accent-saffron)" }}
                      aria-hidden
                    >
                      ▶
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <TrialBanner />
          <div className={cn(
            "gradient-bg-subtle flex-1 overflow-x-hidden overflow-y-auto",
            editorMode
              ? "px-0 pt-0 pb-[env(safe-area-inset-bottom)] lg:p-0"
              : "px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-8 sm:pt-4 lg:p-8"
          )}>
            <div className="w-full min-w-0 max-w-full">{children}</div>
          </div>
        </main>
        {showTrialGate && <TrialExpiredGate trialDays={trialDays} />}

        {!editorMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md lg:hidden safe-area-pb shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          <div className="grid grid-cols-5 items-end">
            {[
              { icon: Home, label: "Home", path: "/dashboard", match: "exact" as const },
              { icon: Video, label: "My Videos", path: "/videos", match: "prefix" as const },
              { icon: Activity, label: "Activity", path: "/insights", match: "prefix" as const },
              { icon: Wrench, label: "Tools", path: "/tools", match: "prefix" as const },
              { icon: User, label: "Profile", path: "/profile", match: "prefix" as const },
            ].map((item) => {
              const active = item.match === "exact"
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <TLink
                  key={item.path}
                  to={item.path as any}
                  preload="intent"
                  className={cn(
                    "flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-transform duration-100 active:scale-95",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="truncate">{item.label}</span>
                </TLink>
              );
            })}
          </div>
        </nav>
        )}
      </div>
    </div>
  );
};
