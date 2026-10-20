import { FileText, Video, Table2, Presentation, Link as LinkIcon, LayoutGrid, LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Resource } from "@/hooks/useResources";
import { ResourceCard } from "./ResourceCard";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "react-i18next";

interface ResourceTabsProps {
  resources: Resource[];
  onDownload: (resource: Resource) => void;
}

interface TabConfig {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  types: string[];
}

export function ResourceTabs({ resources, onDownload }: ResourceTabsProps) {
  const { t } = useTranslation(['dashboard']);
  
  const tabs: TabConfig[] = [
    { id: "all", labelKey: "dashboard:resources.tabs.all", icon: LayoutGrid, types: [] },
    { id: "documents", labelKey: "dashboard:resources.tabs.documents", icon: FileText, types: ["pdf", "word"] },
    { id: "videos", labelKey: "dashboard:resources.tabs.videos", icon: Video, types: ["video", "webinar"] },
    { id: "spreadsheets", labelKey: "dashboard:resources.tabs.spreadsheets", icon: Table2, types: ["excel"] },
    { id: "presentations", labelKey: "dashboard:resources.tabs.presentations", icon: Presentation, types: ["powerpoint"] },
    { id: "links", labelKey: "dashboard:resources.tabs.links", icon: LinkIcon, types: ["link", "directory", "event"] },
  ];
  const getResourcesForTab = (tab: TabConfig): Resource[] => {
    if (tab.id === "all") return resources;
    return resources.filter(r => tab.types.includes(r.file_type));
  };

  const getTabCount = (tab: TabConfig): number => {
    return getResourcesForTab(tab).length;
  };

  // Only show tabs that have resources (except "all" which always shows)
  const visibleTabs = tabs.filter(tab => tab.id === "all" || getTabCount(tab) > 0);

  return (
    <Tabs defaultValue="all" className="w-full">
      <div className="mb-6 overflow-x-auto pb-1">
        <TabsList className="inline-flex h-auto p-1.5 bg-muted/50 backdrop-blur-sm rounded-xl">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const count = getTabCount(tab);
            
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg",
                  "text-sm font-medium transition-all",
                  "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                  "data-[state=active]:text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "h-5 min-w-5 px-1.5 text-xs font-medium",
                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  )}
                >
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {visibleTabs.map((tab) => {
        const tabResources = getResourcesForTab(tab);
        
        return (
          <TabsContent 
            key={tab.id} 
            value={tab.id}
            className="mt-0 animate-fade-in"
          >
            {tabResources.length === 0 ? (
              <EmptyState
                icon={tab.icon}
                title={t('dashboard:resources.emptyState.noResults')}
                description={t('dashboard:resources.emptyState.checkBackLater')}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tabResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onDownload={onDownload}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}








