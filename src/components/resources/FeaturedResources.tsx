import { Sparkles } from "lucide-react";
import type { Resource } from "@/hooks/useResources";
import { ResourceCard } from "./ResourceCard";

interface FeaturedResourcesProps {
  resources: Resource[];
  onDownload: (resource: Resource) => void;
}

export function FeaturedResources({ resources, onDownload }: FeaturedResourcesProps) {
  if (resources.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Featured Resources</h2>
          <p className="text-sm text-muted-foreground">Hand-picked to help you succeed</p>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.slice(0, 3).map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            onDownload={onDownload}
            variant="featured"
          />
        ))}
      </div>
    </section>
  );
}
