import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Download, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import {
  PartnerRankedApplication,
  usePartnerApplicationsRanked,
  downloadQualifiedApplicantsCSV,
} from "@/hooks/usePartnerApplicationsRanked";
import { format } from "date-fns";

const scoreBadgeClass = (score: number | null) => {
  if (score === null || Number.isNaN(score))
    return "bg-muted text-muted-foreground border-border";
  if (score >= 8) return "bg-success/10 text-success border-success/20";
  if (score >= 5) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  under_review: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

type StatusFilter = "all" | "approved" | "pending" | "rejected" | "under_review";

const QualifiedApplicants = () => {
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredApplications = useMemo(() => {
    if (statusFilter === "all") return rankedApplications;
    return rankedApplications.filter((app) => app.status === statusFilter);
  }, [rankedApplications, statusFilter]);

  const approvedCount = useMemo(
    () => rankedApplications.filter((a) => a.status === "approved").length,
    [rankedApplications]
  );

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
        cell: ({ row }) => <p className="font-medium">{row.original.applicant_name}</p>,
      },
      {
        accessorKey: "applicant_email",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Email" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.applicant_email || "—"}</span>
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
      filteredApplications,
      `applications-opportunity-${id}-${statusFilter}.csv`
    );
  };

  const handleExportApproved = () => {
    const approved = rankedApplications.filter((a) => a.status === "approved");
    downloadQualifiedApplicantsCSV(
      approved,
      `qualified-applicants-opportunity-${id}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Qualified Applicants</h1>
          <p className="text-muted-foreground">
            {opportunity?.title || "Loading..."} - Ranked by review scores
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportApproved}
            disabled={approvedCount === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Qualified ({approvedCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={filteredApplications.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Current View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/partner/opportunities/${id}/applications`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Applications
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{rankedApplications.length}</p>
            <p className="text-xs text-muted-foreground">Total Applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold text-emerald-600">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Qualified / Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">
              {rankedApplications.filter((a) => a.total_reviews > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">
              {rankedApplications.filter((a) => a.status === "pending").length}
            </p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Applications by Rank</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved Only</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredApplications}
            searchPlaceholder="Search by applicant name or email..."
            pageSize={10}
            enableSorting={true}
            enablePagination={true}
            onRefresh={() => { refetch(); }}
            isRefreshing={isFetching || isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default QualifiedApplicants;








