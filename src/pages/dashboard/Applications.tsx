import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, MapPin, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicationListSkeleton } from "@/components/ui/skeletons";
import { useApplications, type ApplicationWithProject } from "@/hooks/useApplications";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { getApplicationStatusBadgeClassName } from "@/lib/statusBadges";
import { formatDate } from "@/lib/dateUtils";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";

const Applications = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading, error, refetch, isRefetching } = useApplications();

  const {
    filteredApplications,
    statusCounts,
    statusFilter,
    setStatusFilter,
  } = useApplicationFilters({
    applications,
    defaultFilter: "all",
    statusValues: ["pending", "approved", "rejected", "draft"],
  });

  // Define columns for the applications table
  const applicationColumns: ColumnDef<ApplicationWithProject>[] = useMemo(() => [
    {
      accessorKey: 'projectTitle',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => {
        return <span className="font-medium">{row.original.projectTitle}</span>;
      },
    },
    {
      accessorKey: 'sector',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Sector" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{row.original.sector}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'country',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Country" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{row.original.country}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const statusDescriptions: Record<string, string> = {
          pending: "Your application is being reviewed by our team",
          approved: "Congratulations! Your application has been approved",
          rejected: "Your application was not selected this time",
          draft: "This application is saved but not yet submitted",
          under_review: "Your application is currently under review",
        };
        
        return (
          <div className="flex items-center gap-2">
            <Badge className={getApplicationStatusBadgeClassName(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            <HelpTooltip 
              content={statusDescriptions[status] || "Application status"}
              side="top"
            />
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.status.localeCompare(rowB.original.status);
      },
    },
    {
      accessorKey: 'submittedAt',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Submitted" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatDate(row.original.submittedAt)}
            </span>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.submittedAt).getTime();
        const dateB = new Date(rowB.original.submittedAt).getTime();
        return dateA - dateB;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const app = row.original;
        if (app.status === "draft") {
          return (
            app.isProjectOpen ? (
              <Link to={`/projects/${app.projectId}/apply`}>
                <Button variant="outline" size="sm">
                  Continue Application
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Application Closed
              </Button>
            )
          );
        }
        return (
          <Link to={`/dashboard/applications/${app.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
        );
      },
    },
  ], []);

  const isFirstTime = applications.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">My Applications</h1>
          <HelpTooltip 
            content="Track the status of all your funding applications. You can filter by status, search, and view detailed information about each application."
            side="right"
          />
        </div>
        <p className="text-muted-foreground mt-2">
          Track and manage your funding applications ({filteredApplications.length})
        </p>
      </div>

      {/* First-time user tip */}
      {isFirstTime && (
        <InAppTip
          id="first-application-tip"
          type="tip"
          title="Ready to apply for funding?"
          description="Browse available opportunities and submit your first application. Make sure your profile is complete to increase your chances of approval."
          action={{
            label: "Browse Opportunities",
            onClick: () => navigate("/projects"),
          }}
        />
      )}

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 -mb-2 scrollbar-hide">
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
        </CardContent>
      </Card>

      {/* Applications Table */}
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
        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilter === "all" 
                ? "All Applications" 
                : statusFilter === "pending"
                ? "Pending Applications"
                : statusFilter === "approved"
                ? "Approved Applications"
                : statusFilter === "rejected"
                ? "Rejected Applications"
                : "Draft Applications"} ({filteredApplications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={applicationColumns}
              data={filteredApplications}
              searchPlaceholder="Search by project title, sector, or country..."
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              enableExport={true}
              exportFileName={`my-applications-${statusFilter}`}
              onRefresh={() => { refetch(); }}
              isRefreshing={isRefetching}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={FileText}
              title={
                statusFilter !== "all"
                  ? `No ${statusFilter} applications`
                  : "No applications yet"
              }
              description={
                statusFilter !== "all"
                  ? "Try adjusting your filter criteria to find more applications."
                  : "Start by browsing available opportunities and submitting your first application."
              }
              action={
                statusFilter === "all"
                  ? {
                      label: "Browse Opportunities",
                      onClick: () => navigate("/projects"),
                      variant: "hero",
                    }
                  : {
                      label: "Clear Filter",
                      onClick: () => setStatusFilter("all"),
                      variant: "outline",
                    }
              }
              secondaryAction={
                statusFilter === "all"
                  ? {
                      label: "View Guide",
                      onClick: () => navigate("/guide"),
                      variant: "outline",
                    }
                  : undefined
              }
              helpLink={statusFilter === "all" ? "/help" : undefined}
              tips={
                statusFilter === "all"
                  ? [
                      "Complete your profile to increase approval chances",
                      "Read project requirements carefully before applying",
                      "You can save applications as drafts and submit later",
                      "Check application deadlines to avoid missing opportunities",
                    ]
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
