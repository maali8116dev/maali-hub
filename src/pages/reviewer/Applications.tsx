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
import { formatDate } from "@/lib/dateUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";
import { useTranslation } from "react-i18next";

const ReviewerApplications = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(["dashboard", "common"]);
  const deadlineTooltip = t("dashboard:reviewer.dashboardPage.deadlineTooltip");
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
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.applicant")} />
        ),
        cell: ({ row }) => {
          return <span className="font-medium">{row.original.applicantName}</span>;
        },
      },
      {
        accessorKey: 'projectTitle',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.project")} />
        ),
        cell: ({ row }) => {
          return <span className="text-sm">{row.original.projectTitle}</span>;
        },
      },
      {
        accessorKey: 'reviewDeadline',
        header: ({ column }) => (
          <div className="flex items-center gap-1">
            <SortableColumnHeader column={column} title={t("dashboard:applications.columns.reviewDeadline")} />
            <HelpTooltip content={deadlineTooltip} />
          </div>
        ),
        cell: ({ row }) => {
          const app = row.original;
          if (!app.reviewDeadline) {
            return <span className="text-sm text-muted-foreground">{t("dashboard:reviewer.applicationsPage.noDeadline")}</span>;
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
                      {t("dashboard:reviewer.dashboardPage.recent.overdue")}
                    </Badge>
                  )}
                  {isApproaching && !isOverdue && (
                    <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {app.daysUntilDeadline === 0
                        ? t("dashboard:reviewer.dashboardPage.recent.dueToday")
                        : t("dashboard:reviewer.dashboardPage.recent.daysLeft", { count: app.daysUntilDeadline })}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{deadlineTooltip}</p>
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
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.daysPending")} />
        ),
        cell: ({ row }) => {
          const daysPending = row.original.daysPending;
          return (
            <Badge 
              className={daysPending >= 5 ? "bg-warning/10 text-warning border-warning/20" : "bg-secondary"}
            >
              <Clock className="h-3 w-3 mr-1" />
              {daysPending} {daysPending === 1 ? t("dashboard:reviewer.applicationsPage.day") : t("dashboard:reviewer.applicationsPage.days")}
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
        <SortableColumnHeader column={column} title={t("dashboard:applications.columns.status")} />
      ),
      cell: ({ row }) => {
        const app = row.original;
        const status = app.status;
        const reviewProgress = app.reviewProgress;
        
        const statusDescriptions: Record<string, string> = {
          draft: t("dashboard:reviewer.applicationsPage.statusDescriptions.draft"),
          pending: t("dashboard:reviewer.applicationsPage.statusDescriptions.pending"),
          under_review: t("dashboard:reviewer.applicationsPage.statusDescriptions.under_review", {
            completed: reviewProgress?.completed || 0,
            total: reviewProgress?.total || 0,
          }),
          approved: t("dashboard:reviewer.applicationsPage.statusDescriptions.approved"),
          rejected: t("dashboard:reviewer.applicationsPage.statusDescriptions.rejected"),
        };
        
        return (
          <div className="flex items-center gap-2">
            {getApplicationStatusBadge(status, reviewProgress, t)}
            <HelpTooltip 
              content={statusDescriptions[status] || t("dashboard:reviewer.applicationsPage.statusDescriptions.default")}
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
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.submitted")} />
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
        header: t("dashboard:applications.columns.actions"),
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
                ? t("dashboard:reviewer.applicationsPage.actions.startReview")
                : statusFilter === "draft"
                  ? t("dashboard:reviewer.applicationsPage.actions.continueReview")
                  : t("dashboard:reviewer.applicationsPage.actions.review")}
            </Button>
          );
        },
      }
    );

    return baseColumns;
  }, [statusFilter, navigate, t, deadlineTooltip]);

  const pageTitle = t("dashboard:reviewer.pages.applications");
  const pageSubtitle = t("dashboard:reviewer.applicationsPage.subtitle");
  const pageSubtitleCount = t("dashboard:reviewer.applicationsPage.subtitleCount", {
    count: processedApplications.length,
  });

  const filterOptions = [
    { value: "all", label: t("dashboard:applications.filters.all") },
    { value: "draft", label: t("dashboard:applications.filters.drafts") },
    { value: "pending", label: t("dashboard:applications.filters.pending") },
    { value: "under_review", label: t("dashboard:applications.filters.under_review") },
    { value: "approved", label: t("dashboard:applications.filters.approved") },
    { value: "rejected", label: t("dashboard:applications.filters.rejected") },
  ] as const;

  const tableTitleKey = statusFilter === "all"
    ? "all"
    : statusFilter === "draft"
      ? "draft"
      : statusFilter === "pending"
        ? "pending"
        : statusFilter === "under_review"
          ? "under_review"
          : statusFilter === "approved"
            ? "approved"
            : "rejected";

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{pageSubtitle}</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{pageSubtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              {t("dashboard:reviewer.applicationsPage.loadError", {
                message: error instanceof Error ? error.message : t("dashboard:reviewer.applicationsPage.unknownError"),
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{pageTitle}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{pageSubtitleCount}</p>
      </div>

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((filter) => (
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
                <p className="font-medium">{t("dashboard:reviewer.applicationsPage.priorityAlert.title")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("dashboard:reviewer.applicationsPage.priorityAlert.description")}
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
            {t(`dashboard:reviewer.applicationsPage.tableTitles.${tableTitleKey}`)} ({processedApplications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <DataTable
            columns={applicationColumns}
            data={processedApplications}
            searchPlaceholder={t("dashboard:reviewer.applicationsPage.searchPlaceholder")}
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








