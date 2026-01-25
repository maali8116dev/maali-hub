import { FileText, Video, Table2, Presentation, Link as LinkIcon, LayoutGrid, LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Resource } from "@/hooks/useResources";
import { ResourceCard } from "./ResourceCard";
import { EmptyState } from "@/components/ui/empty-state";

interface ResourceTabsProps {
  resources: Resource[];
  onDownload: (resource: Resource) => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  types: string[];
}

const tabs: TabConfig[] = [
  { id: "all", label: "All", icon: LayoutGrid, types: [] },
  { id: "documents", label: "Documents", icon: FileText, types: ["pdf", "word"] },
  { id: "videos", label: "Videos", icon: Video, types: ["video", "webinar"] },
  { id: "spreadsheets", label: "Spreadsheets", icon: Table2, types: ["excel"] },
  { id: "presentations", label: "Presentations", icon: Presentation, types: ["powerpoint"] },
  { id: "links", label: "Links", icon: LinkIcon, types: ["link", "directory", "event"] },
];

export function ResourceTabs({ resources, onDownload }: ResourceTabsProps) {
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
                <span className="hidden sm:inline">{tab.label}</span>
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
                title={`No ${tab.label.toLowerCase()} available`}
                description="Check back later for new resources"
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
