import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, Calendar, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicationListSkeleton } from "@/components/ui/skeletons";
import { useApplications, type ApplicationWithProject } from "@/hooks/useApplications";

const Applications = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading, error } = useApplications();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.sector.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-warning/10 text-warning border-warning/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const statusCounts = useMemo(() => {
    return {
      all: applications.length,
      pending: applications.filter((a) => a.status === "pending").length,
      approved: applications.filter((a) => a.status === "approved").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
      draft: applications.filter((a) => a.status === "draft").length,
    };
  }, [applications]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your funding applications
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            {/* Status filter buttons - scrollable on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "draft", label: "Draft" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                  className="flex-shrink-0 min-h-[40px] px-3"
                >
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="sm:hidden">{filter.label.slice(0, 3)}</span>
                  <span className="ml-1">({statusCounts[filter.value as keyof typeof statusCounts]})</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      {isLoading ? (
        <ApplicationListSkeleton count={5} />
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={FileText}
              title="Error loading applications"
              description="There was an error loading your applications. Please try again later."
            />
          </CardContent>
        </Card>
      ) : filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg sm:text-xl mb-2 line-clamp-2">{app.projectTitle}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{app.sector}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{app.country}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span className="whitespace-nowrap">{new Date(app.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={`${getStatusBadge(app.status)} flex-shrink-0`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Funding Amount
                    </p>
                    <p className="text-lg font-semibold">{app.fundingAmount}</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    {app.status === "draft" ? (
                      <Link to={`/projects/${app.projectId}/apply`} className="block">
                        <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">Continue Application</Button>
                      </Link>
                    ) : (
                      <Link to={`/dashboard/applications/${app.id}`} className="block">
                        <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">View Details</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={FileText}
              title="No applications found"
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria to find more applications."
                  : "Start by browsing available opportunities and submitting your first application."
              }
              action={
                !searchQuery && statusFilter === "all"
                  ? {
                      label: "Browse Opportunities",
                      onClick: () => navigate("/projects"),
                      variant: "hero",
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Applications;

