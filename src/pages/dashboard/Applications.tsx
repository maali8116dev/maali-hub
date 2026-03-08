import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, MapPin, Eye } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicationListSkeleton } from "@/components/ui/skeletons";
import { useApplications, type ApplicationWithOpportunity } from "@/hooks/useApplications";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { getApplicationStatusBadgeClassName } from "@/lib/statusBadges";
import { formatDate } from "@/lib/dateUtils";
import { useApplicationFilters } from "@/hooks/useApplicationFilters";
import { useTranslation } from "react-i18next";

const Applications = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['dashboard']);
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
  const applicationColumns: ColumnDef<ApplicationWithOpportunity>[] = useMemo(() => [
    {
      accessorKey: 'projectTitle',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t('dashboard:applications.columns.project')} />
      ),
      cell: ({ row }) => {
        return <span className="font-medium">{row.original.projectTitle}</span>;
      },
    },
    {
      accessorKey: 'sector',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t('dashboard:applications.columns.sector')} />
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
        <SortableColumnHeader column={column} title={t('dashboard:applications.columns.country')} />
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
        <SortableColumnHeader column={column} title={t('dashboard:applications.columns.status')} />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const statusDescriptions: Record<string, string> = {
          pending: t('dashboard:applications.statusDescriptions.pending'),
          approved: t('dashboard:applications.statusDescriptions.approved'),
          rejected: t('dashboard:applications.statusDescriptions.rejected'),
          draft: t('dashboard:applications.statusDescriptions.draft'),
          under_review: t('dashboard:applications.statusDescriptions.under_review'),
        };
        
        return (
          <div className="flex items-center gap-2">
            <Badge className={getApplicationStatusBadgeClassName(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            <HelpTooltip 
              content={statusDescriptions[status] || t('dashboard:applications.statusDescriptions.default')}
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
        <SortableColumnHeader column={column} title={t('dashboard:applications.columns.submitted')} />
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
      header: t('dashboard:applications.columns.actions'),
      cell: ({ row }) => {
        const app = row.original;
        if (app.status === "draft") {
          return (
            app.isProjectOpen ? (
              <Link to={`/opportunities/${app.opportunityId}/apply`}>
                <Button variant="outline" size="sm">
                  {t('dashboard:applications.actions.continueApplication')}
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                {t('dashboard:applications.actions.applicationClosed')}
              </Button>
            )
          );
        }
        return (
          <Link to={`/dashboard/applications/${app.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              {t('dashboard:applications.actions.viewDetails')}
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
          <h1 className="text-3xl font-bold">{t('dashboard:applications.title')}</h1>
          <HelpTooltip 
            content={t('dashboard:applications.helpTooltip')}
            side="right"
          />
        </div>
        <p className="text-muted-foreground mt-2">
          {t('dashboard:applications.subtitle')} ({filteredApplications.length})
        </p>
      </div>

      {/* First-time user tip */}
      {isFirstTime && (
        <InAppTip
          id="first-application-tip"
          type="tip"
          title={t('dashboard:applications.firstTimeTip.title')}
          description={t('dashboard:applications.firstTimeTip.description')}
          action={{
            label: t('dashboard:applications.firstTimeTip.action'),
            onClick: () => navigate("/opportunities"),
          }}
        />
      )}

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 -mb-2 scrollbar-hide">
            {[
              { value: "all", label: t('dashboard:applications.filters.all') },
              { value: "pending", label: t('dashboard:applications.filters.pending') },
              { value: "approved", label: t('dashboard:applications.filters.approved') },
              { value: "rejected", label: t('dashboard:applications.filters.rejected') },
              { value: "draft", label: t('dashboard:applications.filters.draft') },
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
              title={t('dashboard:applications.emptyState.errorTitle')}
              description={t('dashboard:applications.emptyState.errorDesc')}
            />
          </CardContent>
        </Card>
      ) : filteredApplications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilter === "all" 
                ? t('dashboard:applications.table.allApplications')
                : statusFilter === "pending"
                ? t('dashboard:applications.table.pendingApplications')
                : statusFilter === "approved"
                ? t('dashboard:applications.table.approvedApplications')
                : statusFilter === "rejected"
                ? t('dashboard:applications.table.rejectedApplications')
                : t('dashboard:applications.table.draftApplications')} ({filteredApplications.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={applicationColumns}
              data={filteredApplications}
              searchPlaceholder={t('dashboard:applications.table.searchPlaceholder')}
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
                  ? `${t('dashboard:applications.emptyState.noFilteredApplications')} ${t(`dashboard:applications.filters.${statusFilter}`)}`
                  : t('dashboard:applications.emptyState.noApplications')
              }
              description={
                statusFilter !== "all"
                  ? t('dashboard:applications.emptyState.noFilteredApplicationsDesc')
                  : t('dashboard:applications.emptyState.noApplicationsDesc')
              }
              action={
                statusFilter === "all"
                  ? {
                      label: t('dashboard:applications.emptyState.browseOpportunities'),
                      onClick: () => navigate("/opportunities"),
                      variant: "hero",
                    }
                  : {
                      label: t('dashboard:applications.emptyState.clearFilter'),
                      onClick: () => setStatusFilter("all"),
                      variant: "outline",
                    }
              }
              secondaryAction={
                statusFilter === "all"
                  ? {
                      label: t('dashboard:applications.emptyState.viewGuide'),
                      onClick: () => navigate("/guide"),
                      variant: "outline",
                    }
                  : undefined
              }
              helpLink={statusFilter === "all" ? "/help" : undefined}
              tips={
                statusFilter === "all"
                  ? [
                      t('dashboard:applications.emptyState.tips.completeProfile'),
                      t('dashboard:applications.emptyState.tips.readRequirements'),
                      t('dashboard:applications.emptyState.tips.saveDrafts'),
                      t('dashboard:applications.emptyState.tips.checkDeadlines'),
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
