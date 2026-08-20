import { useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, ArrowLeft, Download, FileText, Inbox, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { usePartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import { useLocalizedOpportunity } from "@/lib/localizedContent";
import { getApplicationStatusBadge } from "@/lib/statusBadges";
import {
  PartnerRankedApplication,
  usePartnerApplicationsRanked,
  downloadQualifiedApplicantsCSV,
  type PartnerRankedCsvLabels,
} from "@/hooks/usePartnerApplicationsRanked";
import { formatDateForLanguage } from "@/hooks/useFormattedDistance";
import { TableSkeleton } from "@/components/ui/skeletons";

const scoreBadgeClass = (score: number | null) => {
  if (score === null || Number.isNaN(score))
    return "bg-muted text-muted-foreground border-border";
  if (score >= 8) return "bg-success/10 text-success border-success/20";
  if (score >= 5) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

const STATUS_FILTERS = ["all", "approved", "pending", "rejected", "under_review"] as const;

function RankedApplicationsMobileList({
  applications,
  t,
  language,
}: {
  applications: PartnerRankedApplication[];
  t: ReturnType<typeof useTranslation>["t"];
  language: string;
}) {
  if (applications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("dashboard:partner.rankedApplicationsPage.filters.noResults")}
      </p>
    );
  }

  return (
    <div className="space-y-3 p-4 md:hidden">
      {applications.map((app) => (
        <div key={app.application_id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{app.applicant_name}</p>
              <p className="text-sm text-muted-foreground truncate">{app.applicant_email || "—"}</p>
            </div>
            <Badge variant="outline" className="text-xs font-mono shrink-0">
              #{app.rank_position}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {getApplicationStatusBadge(app.status, t)}
            <Badge className={scoreBadgeClass(app.average_score)}>
              {app.average_score?.toFixed(1) ?? t("dashboard:applications.detail.values.na")}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {t("dashboard:applications.columns.reviews")}: {app.total_reviews}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard:applications.columns.submitted")}:{" "}
            {formatDateForLanguage(app.submitted_at, language)}
          </p>
        </div>
      ))}
    </div>
  );
}

const PartnerOpportunityApplications = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromNotification = searchParams.get("from") === "notification";
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const opportunityId = id ? parseInt(id, 10) : undefined;
  const { data: opportunityRaw } = usePartnerOpportunity(opportunityId);
  const opportunity = useLocalizedOpportunity(opportunityRaw);
  const {
    data: rankedApplications = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = usePartnerApplicationsRanked(opportunityId);
  const [topCount, setTopCount] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [minScore, setMinScore] = useState("");

  const csvLabels: PartnerRankedCsvLabels = useMemo(
    () => ({
      rank: t("dashboard:partner.rankedApplicationsPage.csv.rank"),
      applicantName: t("dashboard:partner.rankedApplicationsPage.csv.applicantName"),
      organization: t("dashboard:partner.rankedApplicationsPage.csv.organization"),
      email: t("dashboard:partner.rankedApplicationsPage.csv.email"),
      projectTitle: t("dashboard:partner.rankedApplicationsPage.csv.projectTitle"),
      status: t("dashboard:partner.rankedApplicationsPage.csv.status"),
      avgScore: t("dashboard:partner.rankedApplicationsPage.csv.avgScore"),
      reviews: t("dashboard:partner.rankedApplicationsPage.csv.reviews"),
      submitted: t("dashboard:partner.rankedApplicationsPage.csv.submitted"),
      na: t("dashboard:applications.detail.values.na"),
    }),
    [t],
  );

  const reviewPending =
    rankedApplications.length > 0 &&
    rankedApplications.every((app) => app.total_reviews === 0);

  const reviewComplete = rankedApplications.length > 0 && !reviewPending;

  const filteredApplications = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    return rankedApplications.filter((app) => {
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (min !== null && !Number.isNaN(min) && (app.average_score ?? -Infinity) < min) return false;
      return true;
    });
  }, [rankedApplications, statusFilter, minScore]);

  const columns: ColumnDef<PartnerRankedApplication>[] = useMemo(
    () => [
      {
        accessorKey: "rank_position",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.rank")} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs font-mono">
            #{row.original.rank_position}
          </Badge>
        ),
        sortingFn: (rowA, rowB) =>
          rowA.original.rank_position - rowB.original.rank_position,
      },
      {
        accessorKey: "applicant_name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.applicant")} />
        ),
        cell: ({ row }) => <p className="font-medium">{row.original.applicant_name}</p>,
      },
      {
        accessorKey: "applicant_email",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.email")} />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.applicant_email || "—"}</span>
        ),
      },
      {
        accessorKey: "average_score",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.avgScore")} />
        ),
        cell: ({ row }) => (
          <Badge className={scoreBadgeClass(row.original.average_score)}>
            {row.original.average_score?.toFixed(1) ?? t("dashboard:applications.detail.values.na")}
          </Badge>
        ),
        sortingFn: (rowA, rowB) =>
          (rowA.original.average_score ?? -Infinity) -
          (rowB.original.average_score ?? -Infinity),
      },
      {
        accessorKey: "total_reviews",
        header: t("dashboard:applications.columns.reviews"),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.total_reviews}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("dashboard:applications.columns.status"),
        cell: ({ row }) => getApplicationStatusBadge(row.original.status, t),
      },
      {
        accessorKey: "submitted_at",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title={t("dashboard:applications.columns.submitted")} />
        ),
        cell: ({ row }) => formatDateForLanguage(row.original.submitted_at, i18n.language),
      },
    ],
    [t, i18n.language],
  );

  const handleExportAll = () => {
    downloadQualifiedApplicantsCSV(
      rankedApplications,
      `ranked-applications-opportunity-${id}.csv`,
      csvLabels,
      i18n.language,
    );
  };

  const handleExportTop = () => {
    const normalizedTop = Math.max(1, Math.min(topCount, rankedApplications.length));
    const top = rankedApplications.slice(0, normalizedTop);
    downloadQualifiedApplicantsCSV(
      top,
      `ranked-top-${normalizedTop}-opportunity-${id}.csv`,
      csvLabels,
      i18n.language,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard:partner.rankedApplicationsPage.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard:partner.rankedApplicationsPage.subtitle", {
              title: opportunity?.title || t("dashboard:partner.rankedApplicationsPage.loading"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={rankedApplications.length === 0 || reviewPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("dashboard:partner.rankedApplicationsPage.exportRankedCsv")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/partner/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("dashboard:partner.rankedApplicationsPage.back")}
          </Button>
        </div>
      </div>

      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>{t("dashboard:partner.rankedApplicationsPage.exportOnly.title")}</AlertTitle>
        <AlertDescription>
          {t("dashboard:partner.rankedApplicationsPage.exportOnly.description")}
        </AlertDescription>
      </Alert>

      {(fromNotification || reviewComplete) && !reviewPending && rankedApplications.length > 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t("dashboard:partner.rankedApplicationsPage.reviewComplete.title")}</AlertTitle>
          <AlertDescription>
            {fromNotification
              ? t("dashboard:partner.rankedApplicationsPage.reviewComplete.fromNotification")
              : t("dashboard:partner.rankedApplicationsPage.reviewComplete.description")}
          </AlertDescription>
        </Alert>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("dashboard:partner.rankedApplicationsPage.loadError.title")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {error instanceof Error
                ? error.message
                : t("dashboard:partner.rankedApplicationsPage.loadError.description")}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("dashboard:partner.rankedApplicationsPage.loadError.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={7} />
          </CardContent>
        </Card>
      ) : !isError && rankedApplications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">
              {t("dashboard:partner.rankedApplicationsPage.empty.noSubmissions.title")}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {t("dashboard:partner.rankedApplicationsPage.empty.noSubmissions.description")}
            </p>
          </CardContent>
        </Card>
      ) : !isError ? (
        <>
          {reviewPending && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>
                {t("dashboard:partner.rankedApplicationsPage.empty.reviewPending.title")}
              </AlertTitle>
              <AlertDescription>
                {t("dashboard:partner.rankedApplicationsPage.empty.reviewPending.description", {
                  count: rankedApplications.length,
                })}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{t("dashboard:partner.rankedApplicationsPage.exportTopTitle")}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={topCount}
                    onChange={(event) => setTopCount(Number(event.target.value))}
                    className="w-24"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportTop}
                    disabled={reviewPending}
                  >
                    {t("dashboard:partner.rankedApplicationsPage.exportTop")}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="space-y-1 flex-1 sm:max-w-[200px]">
                  <label className="text-sm font-medium">
                    {t("dashboard:partner.rankedApplicationsPage.filters.status")}
                  </label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(value as (typeof STATUS_FILTERS)[number])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === "all"
                            ? t("dashboard:partner.rankedApplicationsPage.filters.statusAll")
                            : t(`dashboard:partner.qualifiedApplicantsPage.filters.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 sm:max-w-[160px]">
                  <label className="text-sm font-medium">
                    {t("dashboard:partner.rankedApplicationsPage.filters.minScore")}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={minScore}
                    onChange={(event) => setMinScore(event.target.value)}
                    placeholder={t("dashboard:partner.rankedApplicationsPage.filters.minScorePlaceholder")}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <RankedApplicationsMobileList
                applications={filteredApplications}
                t={t}
                language={i18n.language}
              />
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={filteredApplications}
                  searchPlaceholder={t("dashboard:partner.rankedApplicationsPage.searchPlaceholder")}
                  pageSize={10}
                  enableSorting={true}
                  enablePagination={true}
                  onRefresh={() => {
                    refetch();
                  }}
                  isRefreshing={isFetching || isLoading}
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default PartnerOpportunityApplications;
