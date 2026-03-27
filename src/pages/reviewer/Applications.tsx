import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle, Clock, AlertCircle, Users } from "lucide-react";
import { useReviewerApplications } from "@/hooks/useReviewerApplications";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { getApplicationStatusBadge } from "@/lib/statusBadges";
import { formatDate, REVIEW_DEADLINE_TOOLTIP } from "@/lib/dateUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";

const ReviewerApplications = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading, error, refetch, isRefetching } = useReviewerApplications();

  const {
    filteredApplications: baseFilteredApplications,
    statusCounts,
    statusFilter,
    setStatusFilter,
  } = useApplicationFilters({
    applications,
    defaultFilter: "pending",
    statusValues: ["draft", "pending", "under_review", "approved", "rejected"],
  });

  // Filter and process applications with days pending and deadline calculations
  const processedApplications = useMemo(() => {
    // Add days pending and deadline status calculations
    return baseFilteredApplications.map((app) => {
      const submittedDate = new Date(app.submittedAt);
      const today = new Date();
      const daysPending = Math.floor(
        (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Calculate deadline status
      let deadlineStatus: 'overdue' | 'approaching' | 'on-time' | null = null;
      let daysUntilDeadline: number | null = null;
      
      if (app.reviewDeadline) {
        const deadlineDate = new Date(app.reviewDeadline);
        const diffMs = deadlineDate.getTime() - today.getTime();
        daysUntilDeadline = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (daysUntilDeadline < 0) {
          deadlineStatus = 'overdue';
        } else if (daysUntilDeadline <= 2) {
          deadlineStatus = 'approaching';
        } else {
          deadlineStatus = 'on-time';
        }
      }
      
      return {
        ...app,
        daysPending,
        deadlineStatus,
        daysUntilDeadline,
      };
    });
  }, [baseFilteredApplications]);

  // Check if there are pending applications with 5+ days
  const hasPriorityPending = useMemo(() => {
    if (statusFilter !== "pending") return false;
    return processedApplications.some((app) => app.daysPending >= 5);
  }, [processedApplications, statusFilter]);

  // Define columns - conditionally include days pending when viewing pending
  const applicationColumns: ColumnDef<any>[] = useMemo(() => {
    const baseColumns: ColumnDef<any>[] = [
      {
        accessorKey: 'applicantName',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Applicant" />
        ),
        cell: ({ row }) => {
          return <span className="font-medium">{row.original.applicantName}</span>;
        },
      },
      {
        accessorKey: 'projectTitle',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Project" />
        ),
        cell: ({ row }) => {
          return <span className="text-sm">{row.original.projectTitle}</span>;
        },
      },
      {
        accessorKey: 'reviewDeadline',
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <SortableColumnHeader column={column} title="Review Deadline" />
            <HelpTooltip content={REVIEW_DEADLINE_TOOLTIP} />
          </div>
        ),
        cell: ({ row }) => {
          const app = row.original;
          if (!app.reviewDeadline) {
            return <span className="text-sm text-muted-foreground">No deadline</span>;
          }
          
          const deadlineDate = new Date(app.reviewDeadline);
          const isOverdue = app.deadlineStatus === 'overdue';
          const isApproaching = app.daysUntilDeadline !== null && app.daysUntilDeadline <= 2 && !isOverdue;
          
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help w-fit">
                  <span className={`text-sm ${isOverdue ? 'text-destructive font-semibold' : isApproaching ? 'text-warning font-medium' : ''}`}>
                    {formatDate(deadlineDate)}
                  </span>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  )}
                  {isApproaching && !isOverdue && (
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {app.daysUntilDeadline === 0 ? 'Due today' : `${app.daysUntilDeadline} day${app.daysUntilDeadline === 1 ? '' : 's'} left`}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{REVIEW_DEADLINE_TOOLTIP}</p>
              </TooltipContent>
            </Tooltip>
          );
        },
        sortingFn: (rowA, rowB) => {
          const deadlineA = rowA.original.reviewDeadline ? new Date(rowA.original.reviewDeadline).getTime() : 0;
          const deadlineB = rowB.original.reviewDeadline ? new Date(rowB.original.reviewDeadline).getTime() : 0;
          return deadlineA - deadlineB;
        },
      },
    ];

    // Add days pending column only when viewing pending applications
    if (statusFilter === "pending") {
      baseColumns.push({
        accessorKey: 'daysPending',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Days Pending" />
        ),
        cell: ({ row }) => {
          const daysPending = row.original.daysPending;
          return (
            <Badge 
              className={daysPending >= 5 ? "bg-warning/10 text-warning border-warning/20" : "bg-secondary"}
            >
              <Clock className="h-3 w-3 mr-1" />
              {daysPending} {daysPending === 1 ? "day" : "days"}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          return rowA.original.daysPending - rowB.original.daysPending;
        },
      });
    }

    // Add status column (always show, especially important for "all" tab)
    baseColumns.push({
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const app = row.original;
        const status = app.status;
        const reviewProgress = app.reviewProgress;
        
        const statusDescriptions: Record<string, string> = {
          draft: "You saved a draft review and can continue from where you left off",
          pending: "Application is pending review by all assigned reviewers",
          under_review: `Review in progress: ${reviewProgress?.completed || 0} of ${reviewProgress?.total || 0} reviewers have submitted`,
          approved: "Application has been approved",
          rejected: "Application has been rejected",
        };
        
        return (
          <div className="flex items-center gap-2">
            {getApplicationStatusBadge(status, reviewProgress)}
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
    });

    // Add remaining columns
    baseColumns.push(
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
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const app = row.original;
          return (
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => navigate(`/reviewer/applications/${app.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {statusFilter === "pending"
                ? "Start Review"
                : statusFilter === "draft"
                  ? "Continue Review"
                  : "Review"}
            </Button>
          );
        },
      }
    );

    return baseColumns;
  }, [statusFilter, navigate]);

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
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
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading applications: {error instanceof Error ? error.message : "Unknown error"}
            </p>
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
          Review and manage all submitted applications ({processedApplications.length})
        </p>
      </div>

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "draft", label: "Drafts" },
              { value: "pending", label: "Pending" },
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

      {/* Priority Alert - only show when viewing pending applications */}
      {hasPriorityPending && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium">Applications pending for 5+ days</p>
                <p className="text-sm text-muted-foreground">
                  Please prioritize reviewing these applications
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {statusFilter === "all" 
              ? "All Applications" 
              : statusFilter === "draft"
              ? "Draft Reviews"
              : statusFilter === "pending"
              ? "Pending Applications"
              : statusFilter === "under_review"
              ? "Under Review Applications"
              : statusFilter === "approved"
              ? "Approved Applications"
              : "Rejected Applications"} ({processedApplications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <DataTable
            columns={applicationColumns}
            data={processedApplications}
            searchPlaceholder="Search by applicant name, project title, or company..."
            pageSize={10}
            enableSorting={true}
            enablePagination={true}
            enableExport={true}
            exportFileName={`applications-${statusFilter}`}
            onRefresh={() => { refetch(); }}
            isRefreshing={isRefetching}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerApplications;








