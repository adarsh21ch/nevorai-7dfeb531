import { useEffect, useState, useMemo } from "react";
import { GitBranch, Layout, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useLocation, useNavigate } from "@/lib/router-compat";
import FunnelsPage from "@/pages/FunnelsPage";
import LandingPagesPage from "@/pages/LandingPagesPage";
import LivePage from "@/pages/LivePage";
import { PlanFeatureBadge, type GatedFeature } from "@/components/PlanFeatureBadge";

const TOOL_TABS = [
  { key: "funnels", label: "Funnels", icon: GitBranch, Component: FunnelsPage, feature: "funnelCreation" as GatedFeature },
  { key: "landing-pages", label: "Landing Pages", icon: Layout, Component: LandingPagesPage, feature: "landingPages" as GatedFeature },
  { key: "live", label: "Live", icon: Radio, Component: LivePage, feature: "goLive" as GatedFeature },
];

const parseTab = (search: string, validTabs: string[]): string => {
  const tab = new URLSearchParams(search).get("tab") || "funnels";
  return validTabs.includes(tab) ? tab : validTabs[0] || "funnels";
};

const ToolsPage = () => {
  useDocumentTitle("Tools");
  const navigate = useNavigate();
  const location = useLocation();
  const validKeys = useMemo(() => TOOL_TABS.map((t) => t.key), []);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const search = (typeof window !== "undefined" ? window.location.search : "") || "";
    return parseTab(search, validKeys);
  });

  useEffect(() => {
    const search = location.search || (typeof window !== "undefined" ? window.location.search : "");
    const next = parseTab(search, validKeys);
    setActiveTab((prev) => (prev === next ? prev : next));
  }, [validKeys, location.search]);

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
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon size={15} />
                {tab.label}
                <PlanFeatureBadge feature={tab.feature} className="ml-1" />
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

