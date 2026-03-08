import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, X, Tag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCardSkeletonGrid } from "@/components/ui/skeletons";
import { useOpportunities, useOpportunityTags, useOpportunityLocations } from "@/hooks/useOpportunities";
import { useActivePartners } from "@/hooks/usePartners";
import ProjectCard from "@/components/landing/ProjectCard";
import { cn } from "@/lib/utils";
import { getProjectDisplayStatus } from "@/lib/projectAvailability";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Dummy tags to supplement DB tags and fill the cloud
const DUMMY_TAGS = [
  "Women-led", "Youth", "Rural", "Urban", "Cross-border",
  "Social Impact", "Sustainability", "Innovation", "Digital",
  "Capacity Building", "Research", "Community", "Pan-African",
];

const Opportunities = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const { user } = useAuth();

  // Fetch opportunities with filters
  const { data, isLoading, error } = useOpportunities({
    tags: selectedCategory
      ? [selectedCategory.toLowerCase().replace(/\s+/g, "-")]
      : selectedTag
        ? [selectedTag.toLowerCase().replace(/\s+/g, "-")]
        : null,
    status: undefined,
    location: selectedLocation,
    search: searchQuery.trim() || undefined,
    page: currentPage,
    itemsPerPage,
  });

  // Fetch tags, locations, and partners for dropdowns
  const { data: tags = [] } = useOpportunityTags();
  const { data: locations = [] } = useOpportunityLocations();
  const { data: partners = [] } = useActivePartners();

  const categories = tags.map((tag) => tag.name);

  // Build tag cloud: merge DB tags + dummy tags, deduplicate
  const dbTagNames = tags.map((t) => t.name);
  const allCloudTags = Array.from(new Set([...dbTagNames, ...DUMMY_TAGS])).sort();

  // Fetch submitted applications for current user
  const { data: submittedApplications = [] } = useQuery({
    queryKey: ["user-submitted-applications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("applications")
        .select("project_id")
        .eq("user_id", user.id)
        .eq("is_draft", false);
      if (error) return [];
      return (data || []).map((app: any) => app.project_id);
    },
    enabled: !!user,
  });

  const submittedOpportunityIds = new Set(submittedApplications);

  const opportunities = data?.opportunities || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;

  // Client-side status + partner filtering
  const filteredOpportunities = opportunities.filter((opportunity) => {
    // Status filter
    if (selectedStatus) {
      const displayStatus = getProjectDisplayStatus(
        opportunity.status,
        opportunity.deadline,
        opportunity.createdAt,
      );
      if (selectedStatus === "open") {
        if (!(displayStatus === "Open" || displayStatus === "New" || displayStatus === "Closing Soon")) return false;
      } else if (selectedStatus === "closed") {
        if (displayStatus !== "Closed") return false;
      }
    }

    // Partner filter (match by organization_name)
    if (selectedPartner) {
      if (opportunity.organizationName !== selectedPartner) return false;
    }

    return true;
  });

  const hasActiveFilters = !!(selectedCategory || selectedStatus || selectedLocation || selectedPartner || selectedTag);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedStatus(null);
    setSelectedLocation(null);
    setSelectedPartner(null);
    setSelectedTag(null);
    setCurrentPage(1);
  };

  const handleTagClick = (tagName: string) => {
    if (selectedTag === tagName) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tagName);
      setSelectedCategory(null); // clear category when tag is selected
      setCurrentPage(1);
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Current Opportunities
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover funding opportunities and programs designed to empower African entrepreneurs
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search opportunities by title, description, location, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-12 text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tag Cloud */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Browse by tag</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allCloudTags.map((tagName) => {
              const isFromDb = dbTagNames.includes(tagName);
              const isActive = selectedTag === tagName;
              return (
                <Badge
                  key={tagName}
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all text-xs px-3 py-1.5 hover:scale-105",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isFromDb
                        ? "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => handleTagClick(tagName)}
                >
                  {tagName}
                  {isActive && <X className="h-3 w-3 ml-1.5" />}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                {/* Category Filter */}
                <div className="flex-1 w-full md:w-auto">
                  <Label htmlFor="category-filter" className="mb-2 block">Category</Label>
                  <Select
                    value={selectedCategory || "all"}
                    onValueChange={(value) => {
                      setSelectedCategory(value === "all" ? null : value);
                      setSelectedTag(null);
                    }}
                  >
                    <SelectTrigger id="category-filter" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Region Filter */}
                <div className="flex-1 w-full md:w-auto">
                  <Label htmlFor="location-filter" className="mb-2 block">Region</Label>
                  <Select
                    value={selectedLocation || "all"}
                    onValueChange={(value) => setSelectedLocation(value === "all" ? null : value)}
                  >
                    <SelectTrigger id="location-filter" className="w-full">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Regions</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Partner Filter */}
                <div className="flex-1 w-full md:w-auto">
                  <Label htmlFor="partner-filter" className="mb-2 block">Partner</Label>
                  <Select
                    value={selectedPartner || "all"}
                    onValueChange={(value) => setSelectedPartner(value === "all" ? null : value)}
                  >
                    <SelectTrigger id="partner-filter" className="w-full">
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Partners</SelectItem>
                      {partners.map((partner) => (
                        <SelectItem key={partner.id} value={partner.name}>{partner.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="w-full md:w-auto">
                  <Label htmlFor="status-filter" className="mb-2 block">Status</Label>
                  <Select
                    value={selectedStatus || "all"}
                    onValueChange={(value) => setSelectedStatus(value === "all" ? null : value)}
                  >
                    <SelectTrigger id="status-filter" className="w-full md:w-[160px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="outline" onClick={handleClearFilters} className="w-full md:w-auto">
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Opportunities Grid */}
        {isLoading ? (
          <ProjectCardSkeletonGrid count={6} />
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-destructive mb-4">
                  {error instanceof Error ? error.message : "Failed to load opportunities"}
                </p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : filteredOpportunities.length > 0 ? (
          <>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {filteredOpportunities.map((opportunity) => (
                <ProjectCard
                  key={opportunity.id}
                  id={opportunity.id}
                  title={opportunity.title}
                  description={opportunity.description}
                  category={opportunity.tags?.[0]?.name || opportunity.opportunityType}
                  location={opportunity.location}
                  fundingAmount={opportunity.fundingAmount}
                  deadline={opportunity.deadline}
                  currentApplicants={opportunity.currentApplicants}
                  status={opportunity.status}
                  hasSubmittedApplication={submittedOpportunityIds.has(opportunity.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {total > 0 && (
              <div className="mt-8">
                <div className="flex flex-col gap-4">
                  {totalPages > 1 && (
                    <div className="flex justify-center overflow-x-auto pb-2">
                      <Pagination>
                        <PaginationContent className="gap-1">
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              className={cn(
                                "min-h-[44px] min-w-[44px]",
                                currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                              )}
                            />
                          </PaginationItem>

                          {(() => {
                            const pages: (number | "ellipsis")[] = [];
                            const maxVisiblePages = 5;
                            if (totalPages <= maxVisiblePages) {
                              for (let i = 1; i <= totalPages; i++) pages.push(i);
                            } else {
                              pages.push(1);
                              if (currentPage <= 3) {
                                for (let i = 2; i <= 4; i++) pages.push(i);
                                pages.push("ellipsis");
                                pages.push(totalPages);
                              } else if (currentPage >= totalPages - 2) {
                                pages.push("ellipsis");
                                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
                              } else {
                                pages.push("ellipsis");
                                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                                pages.push("ellipsis");
                                pages.push(totalPages);
                              }
                            }
                            return pages.map((page, index) => {
                              if (page === "ellipsis") {
                                return (
                                  <PaginationItem key={`ellipsis-${index}`} className="hidden sm:flex">
                                    <PaginationEllipsis />
                                  </PaginationItem>
                                );
                              }
                              return (
                                <PaginationItem key={page}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(page)}
                                    isActive={currentPage === page}
                                    className="cursor-pointer min-h-[44px] min-w-[44px]"
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            });
                          })()}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              className={cn(
                                "min-h-[44px] min-w-[44px]",
                                currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                              )}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}

                  {/* Results info */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                    <div className="text-muted-foreground order-2 sm:order-1">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, total)} of {total}{" "}
                      opportunit{total !== 1 ? "ies" : "y"}
                    </div>
                    <div className="flex items-center gap-2 order-1 sm:order-2">
                      <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">Show:</Label>
                      <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                        <SelectTrigger id="items-per-page" className="w-[80px] h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="40">40</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={Search}
                title="No opportunities found"
                description={
                  searchQuery || hasActiveFilters
                    ? "Try adjusting your search terms or filters to find more opportunities."
                    : "There are no opportunities available at the moment. Check back later for new opportunities."
                }
                action={
                  searchQuery || hasActiveFilters
                    ? { label: "Clear Filters", onClick: handleClearFilters, variant: "outline" }
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Opportunities;
