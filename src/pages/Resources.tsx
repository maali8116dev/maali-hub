import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, 
  Video, 
  Users, 
  Download, 
  ExternalLink, 
  Search,
  Filter,
  X,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Loader2,
  Table2,
  Presentation,
  Link as LinkIcon,
  Star
} from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useResources, 
  useResourceCategories, 
  useIncrementDownload,
  RESOURCE_CATEGORIES,
  FILE_TYPES,
  type Resource 
} from "@/hooks/useResources";
import { useFAQs } from "@/hooks/useFAQs";

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-5 w-5" />;
    case "video":
    case "webinar":
      return <Video className="h-5 w-5" />;
    case "excel":
      return <Table2 className="h-5 w-5" />;
    case "powerpoint":
      return <Presentation className="h-5 w-5" />;
    case "word":
      return <FileText className="h-5 w-5" />;
    case "link":
    case "directory":
    case "event":
      return <LinkIcon className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Application Guides":
      return FileText;
    case "Video Tutorials":
      return Video;
    case "Mentorship":
      return Users;
    case "Templates":
      return FileText;
    case "Case Studies":
      return Lightbulb;
    case "Webinars":
      return Video;
    default:
      return FileText;
  }
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Resources = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: resources, isLoading } = useResources({
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    fileType: selectedType !== "all" ? selectedType : undefined,
  });
  const { data: categories } = useResourceCategories();
  const { data: faqs } = useFAQs();
  const incrementDownload = useIncrementDownload();

  // Filter by search query
  const filteredResources = resources?.filter(resource =>
    resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resource.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group resources by category
  const groupedResources = filteredResources?.reduce((acc, resource) => {
    if (!acc[resource.category]) {
      acc[resource.category] = [];
    }
    acc[resource.category].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  // Get featured resources
  const featuredResources = resources?.filter(r => r.is_featured);

  const handleDownload = async (resource: Resource) => {
    if (resource.file_url) {
      await incrementDownload.mutateAsync(resource.id);
      window.open(resource.file_url, "_blank");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedType("all");
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || selectedType !== "all";

  // Funding tips (static content)
  const fundingTips = [
    "Start your application early - don't wait until the deadline",
    "Research the funder's priorities and align your project accordingly",
    "Be specific about your budget and how funds will be used",
    "Include measurable outcomes and impact indicators",
    "Get feedback on your application from mentors before submitting"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Resource Library</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Access guides, templates, tutorials, and tools to help you succeed in your funding applications
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {FILE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Featured Resources */}
        {featuredResources && featuredResources.length > 0 && !hasActiveFilters && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" />
              Featured Resources
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredResources.slice(0, 3).map((resource) => (
                <Card key={resource.id} className="hover:shadow-elegant transition-all duration-300 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {getFileIcon(resource.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{resource.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {resource.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs uppercase">
                            {resource.file_type}
                          </Badge>
                          {resource.file_size && (
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(resource.file_size)}
                            </span>
                          )}
                          {resource.duration && (
                            <span className="text-xs text-muted-foreground">
                              {resource.duration}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(resource)}
                      >
                        {resource.file_type === "link" || resource.file_type === "directory" || resource.file_type === "event" ? (
                          <ExternalLink className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Resource Library */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">
            {hasActiveFilters ? "Search Results" : "Browse by Category"}
          </h2>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <Skeleton key={j} className="h-12 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !filteredResources?.length ? (
          <EmptyState
            icon={FileText}
            title="No resources found"
            description={hasActiveFilters 
              ? "Try adjusting your filters or search query"
              : "Resources will appear here once they are added"
            }
            action={hasActiveFilters ? {
              label: "Clear Filters",
              onClick: clearFilters,
              variant: "outline"
            } : undefined}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(groupedResources || {}).map(([category, categoryResources]) => {
                const CategoryIcon = getCategoryIcon(category);
                return (
                  <Card key={category} className="hover:shadow-elegant transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CategoryIcon className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-xl">{category}</CardTitle>
                      </div>
                      <CardDescription>
                        {categoryResources.length} resource{categoryResources.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {categoryResources.map((resource) => (
                          <div 
                            key={resource.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{resource.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {resource.file_type.toUpperCase()}
                                {resource.file_size && ` • ${formatFileSize(resource.file_size)}`}
                                {resource.duration && ` • ${resource.duration}`}
                              </p>
                            </div>
                            {resource.title === "Find a Mentor" ? (
                              <Button size="sm" variant="ghost" asChild>
                                <Link to="/mentors">
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleDownload(resource)}
                                disabled={!resource.file_url}
                              >
                                {resource.file_type === "directory" || resource.file_type === "event" || resource.file_type === "link" ? (
                                  <ExternalLink className="h-4 w-4" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Funding Tips */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Funding Success Tips
          </h2>
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {fundingTips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">{index + 1}</span>
                    </div>
                    <span className="text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        {faqs && faqs.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              Frequently Asked Questions
            </h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.slice(0, 5).map((faq) => (
                    <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {faqs.length > 5 && (
                  <div className="mt-4 pt-4 border-t text-center">
                    <Button variant="outline" asChild>
                      <Link to="/faq">View All FAQs</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contact Support */}
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Need More Help?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Can't find what you're looking for? Our support team is here to help you succeed.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/mentors">Find a Mentor</Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Resources;
