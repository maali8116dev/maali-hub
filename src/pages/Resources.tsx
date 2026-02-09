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
      try {
        await incrementDownload.mutateAsync(resource.id);
        
        // Fetch the file as a blob to preserve the filename
        const response = await fetch(resource.file_url);
        if (!response.ok) {
          throw new Error('Failed to fetch file');
        }
        
        const blob = await response.blob();
        
        // Try to get filename from Content-Disposition header
        let filename = '';
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
            // Decode URI if needed
            try {
              filename = decodeURIComponent(filename);
            } catch {
              // If decoding fails, use as is
            }
          }
        }
        
        // If no filename from header, try to extract from URL
        if (!filename) {
          try {
            const urlPath = new URL(resource.file_url).pathname;
            const urlFilename = urlPath.split('/').pop() || '';
            if (urlFilename && urlFilename.includes('.')) {
              filename = urlFilename;
            }
          } catch {
            // If URL parsing fails, continue to generate filename
          }
        }
        
        // If still no filename, generate from resource title and file type
        if (!filename) {
          const fileExtension = resource.file_type === 'pdf' ? 'pdf' :
                               resource.file_type === 'excel' ? 'xlsx' :
                               resource.file_type === 'word' ? 'docx' :
                               resource.file_type === 'powerpoint' ? 'pptx' :
                               resource.file_type === 'video' ? 'mp4' :
                               resource.file_type === 'webinar' ? 'mp4' :
                               'file';
          
          // Sanitize the title to be a valid filename
          const sanitizedTitle = resource.title
            .replace(/[^a-z0-9]/gi, '_')
            .replace(/_+/g, '_')
            .toLowerCase();
          
          filename = `${sanitizedTitle}.${fileExtension}`;
        }
        
        // Create a download link with the proper filename
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading file:', error);
        // Fallback to opening in new tab if download fails
        window.open(resource.file_url, "_blank");
      }
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
