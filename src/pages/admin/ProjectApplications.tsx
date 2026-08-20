import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle, Eye, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminProjects } from "@/hooks/useAdminProjects";
import {
  RankedApplication,
  useProjectApplicationsRanked,
} from "@/hooks/useProjectApplicationsRanked";
import { useTranslation } from "react-i18next";
import { pickLocalizedField } from "@/lib/localizedContent";

const scoreBadgeClass = (score: number | null) => {
  if (score === null || Number.isNaN(score)) {
    return "bg-muted text-muted-foreground border-border";
  }
  if (score >= 8) return "bg-success/10 text-success border-success/20";
  if (score >= 5) return "bg-warning/10 text-warning border-warning/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
};

const varianceLabel = (variance: number | null) => {
  if (variance === null || Number.isNaN(variance)) {
    return { label: "N/A", className: "bg-muted text-muted-foreground border-border" };
  }
  if (variance < 1) return { label: "Low", className: "bg-success/10 text-success border-success/20" };
  if (variance < 2) return { label: "Medium", className: "bg-warning/10 text-warning border-warning/20" };
  return { label: "High", className: "bg-destructive/10 text-destructive border-destructive/20" };
};

const ProjectApplications = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { i18n } = useTranslation(["dashboard", "common"]);
  const initialProjectId = id ? Number(id) : undefined;
  const [projectId, setProjectId] = useState<number | undefined>(initialProjectId);
  const [scoreModalApp, setScoreModalApp] = useState<RankedApplication | null>(null);

  const { data: projects = [] } = useAdminProjects();
  const {
    data: rankedApplications = [],
    isLoading,
    refetch,
    isFetching,
  } = useProjectApplicationsRanked(projectId);

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({
      id: project.id,
      title: pickLocalizedField(i18n.language, project.title, project.translations, "title"),
    }));
  }, [projects, i18n.language]);

  const currentProject = useMemo(() => {
    return projects.find((project) => project.id === projectId);
  }, [projects, projectId]);

  const reviewedCount = useMemo(() => {
    return rankedApplications.filter((app) => app.total_reviews > 0).length;
  }, [rankedApplications]);

  const columns: ColumnDef<RankedApplication>[] = useMemo(
    () => [
      {
        accessorKey: "rank_position",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Rank" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            #{row.original.rank_position}
          </Badge>
        ),
        sortingFn: (rowA, rowB) => rowA.original.rank_position - rowB.original.rank_position,
      },
      {
        accessorKey: "applicant_name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Applicant" />
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.applicant_name}</p>
            <p className="text-xs text-muted-foreground">{row.original.applicant_email}</p>
          </div>
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
        accessorKey: "score_variance",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Variance" />
        ),
        cell: ({ row }) => {
          const variance = varianceLabel(row.original.score_variance);
          return <Badge className={variance.className}>{variance.label}</Badge>;
        },
      },
      {
        accessorKey: "total_reviews",
        header: "Reviews",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {row.original.total_reviews} review{row.original.total_reviews !== 1 ? "s" : ""}
          </Badge>
        ),
      },
      {
        id: "recommendations",
        header: "Recommendations",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-success">
              <CheckCircle className="h-3 w-3" /> {row.original.recommendations.approve}
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3 w-3" /> {row.original.recommendations.reject}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScoreModalApp(row.original)}
            >
              Scores
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/applications/${row.original.application_id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
          </div>
        ),
      },
    ],
    [navigate]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Project Applications</h1>
        <p className="text-muted-foreground mt-1">
          Rank applicants by score.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Selection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <label className="text-sm font-medium">Project</label>
            <select
              className="mt-2 w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={projectId ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isNaN(value)) return;
                setProjectId(value);
                navigate(`/admin/opportunities/${value}/applications`);
              }}
            >
              <option value="" disabled>
                Select a project
              </option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          {currentProject && (
            <div className="flex items-center gap-3">
              <Badge variant="outline">Applicants: {rankedApplications.length}</Badge>
              <Badge variant="outline">Reviewed: {reviewedCount}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Ranked Applications</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review ranked applications and export results as needed.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={rankedApplications}
            searchPlaceholder="Search by applicant name or email..."
            pageSize={10}
            enableSorting={true}
            enablePagination={true}
            enableExport={true}
            exportFileName="ranked-applications"
            onRefresh={() => { refetch(); }}
            isRefreshing={isFetching || isLoading}
          />
        </CardContent>
      </Card>
      <Dialog open={!!scoreModalApp} onOpenChange={(open) => !open && setScoreModalApp(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reviewer Scores</DialogTitle>
            <DialogDescription>
              {scoreModalApp?.applicant_name} Â· Rank #{scoreModalApp?.rank_position}
            </DialogDescription>
          </DialogHeader>
          {scoreModalApp ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={scoreBadgeClass(scoreModalApp.average_score)}>
                  Avg Score: {scoreModalApp.average_score?.toFixed(1) ?? "N/A"}
                </Badge>
                <Badge className={varianceLabel(scoreModalApp.score_variance).className}>
                  Variance: {varianceLabel(scoreModalApp.score_variance).label}
                </Badge>
                <Badge variant="outline">
                  Reviews: {scoreModalApp.total_reviews}
                </Badge>
              </div>
              <div className="space-y-3">
                {scoreModalApp.reviewer_scores?.length ? (
                  scoreModalApp.reviewer_scores.map((review) => (
                    <Card key={`${scoreModalApp.application_id}-${review.reviewer_id}`}>
                      <CardContent className="pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{review.reviewer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.submitted_at
                                ? new Date(review.submitted_at).toLocaleString()
                                : "Not submitted"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={scoreBadgeClass(review.overall_score ?? null)}>
                              {review.overall_score?.toFixed(1) ?? "N/A"}
                            </Badge>
                            <Badge variant="outline">
                              {review.recommendation || "N/A"}
                            </Badge>
                          </div>
                        </div>
                        {review.comments && (
                          <div className="mt-3 text-sm text-muted-foreground">
                            {review.comments}
                          </div>
                        )}
                        {review.scores && (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            {Object.entries(review.scores).map(([key, value]) => (
                              <div key={`${review.reviewer_id}-${key}`} className="flex justify-between">
                                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                                <span>{value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No reviewer scores yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectApplications;









