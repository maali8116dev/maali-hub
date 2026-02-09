import { useState, useMemo } from "react";
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

const Applications = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading, error } = useApplications();

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      return statusFilter === "all" || app.status === statusFilter;
    });
  }, [applications, statusFilter]);

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
        return (
          <Badge className={getStatusBadge(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
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
              {new Date(row.original.submittedAt).toLocaleDateString()}
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
      accessorKey: 'fundingAmount',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Funding Amount" />
      ),
      cell: ({ row }) => {
        return <span className="text-sm font-medium">{row.original.fundingAmount}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const app = row.original;
        if (app.status === "draft") {
          return (
            <Link to={`/projects/${app.projectId}/apply`}>
              <Button variant="outline" size="sm">
                Continue Application
              </Button>
            </Link>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your funding applications ({filteredApplications.length})
        </p>
      </div>

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
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={FileText}
              title="No applications found"
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
