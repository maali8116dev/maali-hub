import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ResourcesHero } from "@/components/resources/ResourcesHero";
import { FeaturedResources } from "@/components/resources/FeaturedResources";
import { ResourceTabs } from "@/components/resources/ResourceTabs";
import { ResourcesSkeleton } from "@/components/resources/ResourcesSkeleton";
import { QuickLinks } from "@/components/resources/QuickLinks";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";
import { 
  useResources, 
  useIncrementDownload,
  type Resource 
} from "@/hooks/useResources";

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resources, isLoading } = useResources();
  const incrementDownload = useIncrementDownload();

  // Filter resources by search query
  const filteredResources = useMemo(() => {
    if (!resources) return [];
    if (!searchQuery.trim()) return resources;
    
    const query = searchQuery.toLowerCase();
    return resources.filter(resource =>
      resource.title.toLowerCase().includes(query) ||
      resource.description?.toLowerCase().includes(query) ||
      resource.category.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

  // Get featured resources (only show when not searching)
  const featuredResources = useMemo(() => {
    if (searchQuery.trim()) return [];
    return resources?.filter(r => r.is_featured) || [];
  }, [resources, searchQuery]);

  const handleDownload = async (resource: Resource) => {
    if (resource.file_url) {
      await incrementDownload.mutateAsync(resource.id);
      window.open(resource.file_url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pb-16">
        <ResourcesHero 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          totalCount={resources?.length || 0}
        />

        {isLoading ? (
          <ResourcesSkeleton />
        ) : !resources?.length ? (
          <EmptyState
            icon={FileText}
            title="No resources available"
            description="Resources will appear here once they are added by administrators"
          />
        ) : filteredResources.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No results found"
            description={`No resources match "${searchQuery}". Try a different search term.`}
            action={{
              label: "Clear search",
              onClick: () => setSearchQuery(""),
              variant: "outline"
            }}
          />
        ) : (
          <>
            <FeaturedResources 
              resources={featuredResources}
              onDownload={handleDownload}
            />
            
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-6">
                {searchQuery ? `Search results for "${searchQuery}"` : "Browse Resources"}
              </h2>
              
              <ResourceTabs 
                resources={filteredResources}
                onDownload={handleDownload}
              />
            </section>
          </>
        )}

        <QuickLinks />
      </main>

      <Footer />
    </div>
  );
};

export default Resources;
