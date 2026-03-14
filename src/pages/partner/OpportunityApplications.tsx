import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { usePartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import {
  PartnerRankedApplication,
  usePartnerApplicationsRanked,
  downloadQualifiedApplicantsCSV,
} from "@/hooks/usePartnerApplicationsRanked";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/ui/skeletons";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  under_review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const scoreBadgeClass = (score: number | null) => {
  if (score === null || Number.isNaN(score))
    return "bg-muted text-muted-foreground border-border";
  if (score >= 8) return "bg-success/10 text-success border-success/20";
  if (score >= 5) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

const PartnerOpportunityApplications = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id) : undefined;
  const { data: opportunity } = usePartnerOpportunity(opportunityId);
  const {
    data: rankedApplications = [],
    isLoading,
    isFetching,
    refetch,
  } = usePartnerApplicationsRanked(opportunityId);
  const [topCount, setTopCount] = useState<number>(10);

  const columns: ColumnDef<PartnerRankedApplication>[] = useMemo(
    () => [
      {
        accessorKey: "rank_position",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Rank" />
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
          <SortableColumnHeader column={column} title="Applicant" />
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.applicant_name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.applicant_email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "organization_name",
        header: "Organization",
        cell: ({ row }) => row.original.organization_name || "—",
      },
      {
        accessorKey: "project_title",
        header: "Project Title",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.project_title || "—"}</span>
        ),
      },
      {
        accessorKey: "average_score",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Avg Score" />
        ),
        cell: ({ row }) => (
          <Badge className={scoreBadgeClass(row.original.average_score)}>
            {row.original.average_score?.toFixed(1) ?? "N/A"}
          </Badge>
        ),
        sortingFn: (rowA, rowB) =>
          (rowA.original.average_score ?? -Infinity) -
          (rowB.original.average_score ?? -Infinity),
      },
      {
        accessorKey: "total_reviews",
        header: "Reviews",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.total_reviews}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={statusColors[row.original.status] || ""}
          >
            {row.original.status || "pending"}
          </Badge>
        ),
      },
      {
        accessorKey: "submitted_at",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) =>
          format(new Date(row.original.submitted_at), "MMM d, yyyy"),
      },
    ],
    []
  );

  const handleExportAll = () => {
    downloadQualifiedApplicantsCSV(
      rankedApplications,
      `ranked-applications-opportunity-${id}.csv`
    );
  };

  const handleExportTop = () => {
    const normalizedTop = Math.max(1, Math.min(topCount, rankedApplications.length));
    const top = rankedApplications.slice(0, normalizedTop);
    downloadQualifiedApplicantsCSV(
      top,
      `ranked-top-${normalizedTop}-opportunity-${id}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ranked Applications</h1>
          <p className="text-muted-foreground">
            {opportunity?.title || "Loading..."} - Ranked by review scores
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={rankedApplications.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Ranked CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/partner/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Export Top Ranked</CardTitle>
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
              disabled={rankedApplications.length === 0}
            >
              Export Top
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : (
            <DataTable
              columns={columns}
              data={rankedApplications}
              searchPlaceholder="Search by applicant name, email, or organization..."
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching || isLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerOpportunityApplications;








