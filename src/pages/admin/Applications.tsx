import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle, Clock, X, Users } from "lucide-react";
import { useAdminApplications } from "@/hooks/useAdminApplications";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { getApplicationStatusBadge } from "@/lib/statusBadges";
import { formatDate } from "@/lib/dateUtils";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";

const AdminApplications = () => {
  const navigate = useNavigate();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: applications = [], isLoading, error, refetch, isFetching } = useAdminApplications();

  const {
    filteredApplications,
    statusCounts,
    statusFilter,
    setStatusFilter,
  } = useApplicationFilters({
    applications,
    defaultFilter: "all",
    statusValues: ["pending", "pending_payment", "under_review", "approved", "rejected"],
  });

  // Define columns for the applications table
  const applicationColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'applicantName',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Applicant" />
      ),
      cell: ({ row }) => {
        const app = row.original;
        return (
          <div>
            <p className="font-medium">{app.applicantName}</p>
          </div>
        );
      },
    },
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
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        return getApplicationStatusBadge(row.original.status, row.original.reviewProgress);
      },
    },
    {
      accessorKey: 'submittedAt',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Submitted" />
      ),
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.submittedAt)}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.submittedAt).getTime();
        const dateB = new Date(rowB.original.submittedAt).getTime();
        return dateA - dateB;
      },
    },
    {
      accessorKey: 'reviewers',
      header: 'Review Progress',
      cell: ({ row }) => {
        const app = row.original;
        const reviewerCount = app.reviewerDecisions?.length || 0;
        const progress = app.reviewProgress;
        
        if (progress) {
          return (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {progress.completed}/{progress.total} completed
              </Badge>
            </div>
          );
        }
        
        return (
          <div className="flex items-center gap-2">
            {reviewerCount > 0 ? (
              <Badge variant="outline" className="text-xs">
                {reviewerCount} review{reviewerCount !== 1 ? 's' : ''}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">No reviews</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const app = row.original;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/applications/${app.id}`)}
            title="View application details"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        );
      },
    },
  ], [navigate]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Applications</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
      ? error 
      : "Unknown error occurred";
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Applications</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-destructive font-medium">
                Error loading applications
              </p>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          View all submitted applications. To review applications, please use a reviewer account.
        </p>
      </div>

      {/* Role Separation Notice */}
      {!bannerDismissed && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs sm:text-sm mb-1">Role Separation Policy</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Administrative accounts can view applications but cannot approve, reject, or request changes. 
                  This ensures proper separation of concerns, clear accountability, and accurate audit trails. 
                  To perform review actions, please use a reviewer account.
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="flex-shrink-0 p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors min-h-[44px] sm:min-h-0"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "pending_payment", label: "Payment Pending" },
              { value: "under_review", label: "Under Review" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applications ({filteredApplications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={applicationColumns}
              data={filteredApplications}
              searchPlaceholder="Search by applicant name, project title, or company..."
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};


export default AdminApplications;

