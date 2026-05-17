import { useState, useMemo } from "react";
import { GitBranch, Layout, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useNavigate } from "@/lib/router-compat";
import FunnelsPage from "@/pages/FunnelsPage";
import LandingPagesPage from "@/pages/LandingPagesPage";
import LivePage from "@/pages/LivePage";
import { usePlanLimits } from "@/hooks/usePlanLimits";

const getInitialTab = (): string => {
  if (typeof window === "undefined") return "funnels";
  const m = window.location.search.match(/[?&]tab=([^&]+)/);
  return m?.[1] || "funnels";
};

const ToolsPage = () => {
  useDocumentTitle("Tools");
  const navigate = useNavigate();
  const { features } = usePlanLimits();
  const TOOL_TABS = useMemo(() => [
    { key: "funnels", label: "Funnels", icon: GitBranch, Component: FunnelsPage },
    ...(features.landingPages ? [{ key: "landing-pages", label: "Landing Pages", icon: Layout, Component: LandingPagesPage }] : []),
    ...(features.goLive ? [{ key: "live", label: "Live", icon: Radio, Component: LivePage }] : []),
  ], [features.landingPages, features.goLive]);
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    navigate(`/tools?tab=${key}`, { replace: true });
  };

  const Active = TOOL_TABS.find((t) => t.key === activeTab)?.Component || FunnelsPage;

  return (
    <DashboardLayout>
      <div className="-mx-3 mb-4 overflow-x-auto px-3 scrollbar-hide sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-2 pb-1">
          {TOOL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all min-h-[40px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <Active embedded />
    </DashboardLayout>
  );
};

export default ToolsPage;
