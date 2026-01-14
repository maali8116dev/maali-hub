import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCardSkeletonGrid } from "@/components/ui/skeletons";
import { useProjects, useProjectCategories } from "@/hooks/useProjects";
import ProjectCard from "@/components/landing/ProjectCard";

const Projects = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9; // Show 9 projects per page (3 columns × 3 rows)

  // Fetch projects with filters
  const { data, isLoading, error } = useProjects({
    category: selectedCategory,
    status: selectedStatus,
    search: searchQuery.trim() || undefined,
    page: currentPage,
    itemsPerPage,
  });

  // Fetch categories for dropdown
  const { data: categories = [] } = useProjectCategories();

  const projects = data?.projects || [];
  const totalPages = data?.totalPages || 0;
  const total = data?.total || 0;


  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedStatus(null);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Current Opportunities
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover funding opportunities and projects designed to empower African entrepreneurs
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects by title, description, location, or category..."
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

        {/* Filter Dropdowns */}
        <div className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                {/* Category Filter Dropdown */}
                <div className="flex-1 w-full md:w-auto">
                  <Label htmlFor="category-filter" className="mb-2 block">
                    Category
                  </Label>
                  <Select
                    value={selectedCategory || "all"}
                    onValueChange={(value) =>
                      setSelectedCategory(value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger id="category-filter" className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter Dropdown */}
                <div className="w-full md:w-auto">
                  <Label htmlFor="status-filter" className="mb-2 block">
                    Status
                  </Label>
                  <Select
                    value={selectedStatus || "all"}
                    onValueChange={(value) =>
                      setSelectedStatus(value === "all" ? null : value)
                    }
                  >
                    <SelectTrigger id="status-filter" className="w-full md:w-[200px]">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="open">Open </SelectItem>
                      <SelectItem value="closing-soon">Closing Soon</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                     
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters Button */}
                {(selectedCategory || selectedStatus) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedStatus(null);
                    }}
                    className="w-full md:w-auto"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <ProjectCardSkeletonGrid count={6} />
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-destructive mb-4">
                  {error instanceof Error ? error.message : "Failed to load projects"}
                </p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        ) : projects.length > 0 ? (
          <>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  description={project.description}
                  category={project.category}
                  location={project.location}
                  fundingAmount={project.fundingAmount}
                  deadline={project.deadline}
                  currentApplicants={project.currentApplicants}
                  status={project.status}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {(() => {
                      const pages: (number | "ellipsis")[] = [];
                      const maxVisiblePages = 5;

                      if (totalPages <= maxVisiblePages) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        if (currentPage <= 3) {
                          for (let i = 2; i <= 4; i++) {
                            pages.push(i);
                          }
                          pages.push("ellipsis");
                          pages.push(totalPages);
                        } else if (currentPage >= totalPages - 2) {
                          pages.push("ellipsis");
                          for (let i = totalPages - 3; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push("ellipsis");
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            pages.push(i);
                          }
                          pages.push("ellipsis");
                          pages.push(totalPages);
                        }
                      }

                      return pages.map((page, index) => {
                        if (page === "ellipsis") {
                          return (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }

                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      });
                    })()}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                {/* Results count */}
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of{" "}
                  {total} project{total !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={Search}
                title="No projects found"
                description={
                  searchQuery || selectedCategory || selectedStatus
                    ? "Try adjusting your search terms or filters to find more projects."
                    : "There are no projects available at the moment. Check back later for new opportunities."
                }
                action={
                  searchQuery || selectedCategory || selectedStatus
                    ? {
                        label: "Clear Filters",
                        onClick: handleClearFilters,
                        variant: "outline",
                      }
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

export default Projects;

