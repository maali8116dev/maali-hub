import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Eye, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProjects } from "@/hooks/useAdminProjects";
import {
  RankedApplication,
  useProjectApplicationsRanked,
} from "@/hooks/useProjectApplicationsRanked";
import { sendApplicationApprovedEmail, sendEmail } from "@/lib/email";
import { logActivityDirect } from "@/hooks/useActivityLogger";
import { useAuth } from "@/hooks/useAuth";

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const initialProjectId = id ? Number(id) : undefined;
  const [projectId, setProjectId] = useState<number | undefined>(initialProjectId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [topCount, setTopCount] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoreModalApp, setScoreModalApp] = useState<RankedApplication | null>(null);
  const { toast } = useToast();

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
      title: project.title,
    }));
  }, [projects]);

  const currentProject = useMemo(() => {
    return projects.find((project) => project.id === projectId);
  }, [projects, projectId]);

  const reviewedCount = useMemo(() => {
    return rankedApplications.filter((app) => app.total_reviews > 0).length;
  }, [rankedApplications]);

  // Check if winners have already been selected (any application with status "approved")
  const hasWinnersSelected = useMemo(() => {
    return rankedApplications.some((app) => app.status === "approved");
  }, [rankedApplications]);

  const allSelected = rankedApplications.length > 0 && selectedIds.size === rankedApplications.length;
  const hasSelection = selectedIds.size > 0;

  const toggleSelection = (applicationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rankedApplications.map((app) => app.application_id)));
    }
  };

  const handleSelectTop = () => {
    if (!rankedApplications.length) return;
    const sorted = [...rankedApplications].sort((a, b) => a.rank_position - b.rank_position);
    const top = sorted.slice(0, Math.max(1, topCount));
    setSelectedIds(new Set(top.map((app) => app.application_id)));
  };

  const updateApplicationStatus = async (applicationIds: string[], status: "approved" | "rejected") => {
    if (applicationIds.length === 0) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("applications")
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: now,
        review_notes: status === "approved" ? "Selected as winner (ranked)" : "Not selected (ranked)",
        updated_at: now,
      })
      .in("id", applicationIds);

    if (error) throw error;
  };

  const handleApproveSelected = async () => {
    if (!hasSelection) {
      toast({
        title: "No selections",
        description: "Select at least one application to approve.",
        variant: "destructive",
      });
      return;
    }
    if (hasWinnersSelected) {
      toast({
        title: "Winners Already Selected",
        description: "Winners have already been selected for this project.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const approvedIds = Array.from(selectedIds);
      await updateApplicationStatus(approvedIds, "approved");

      // Note: Projects are NOT automatically closed when winners are selected.
      // Projects should only be closed by their deadline or manually by admins.

      // Send approval emails to all approved applicants
      const approvedApplications = rankedApplications.filter((app) =>
        approvedIds.includes(app.application_id)
      );

      // Get project title for email
      const projectTitle = currentProject?.title || "the project";

      // Send emails in parallel (don't block on email failures)
      const emailPromises = approvedApplications.map(async (app) => {
        if (!app.applicant_email || app.applicant_email === "No email") {
          console.warn(`Skipping email for application ${app.application_id}: no email address`);
          return;
        }

        try {
          await sendApplicationApprovedEmail(
            app.applicant_email,
            app.applicant_name,
            projectTitle,
            app.application_id,
            `Congratulations! Your application for "${projectTitle}" has been selected as a winner.`
          );
        } catch (emailError) {
          // Log but don't fail the approval process
          console.error(
            `Failed to send approval email to ${app.applicant_email}:`,
            emailError
          );
        }
      });

      // Wait for all emails (but don't fail if some fail)
      await Promise.allSettled(emailPromises);

      // Get admin profile information for activity log
      const { data: adminProfile } = user
        ? await supabase
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('user_id', user.id)
            .single()
        : { data: null };

      const adminName = adminProfile
        ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || 'Unknown Admin'
        : 'Unknown Admin';

      // Log activity for winner selection
      await logActivityDirect({
        userId: user?.id,
        actionType: 'select_winners',
        entityType: 'project',
        entityId: projectId?.toString(),
        description: `Selected ${selectedIds.size} winner${selectedIds.size > 1 ? 's' : ''} for project "${projectTitle}"`,
        metadata: {
          admin_id: user?.id || null,
          admin_name: adminName,
          admin_role: adminProfile?.role || 'admin',
          project_id: projectId,
          project_title: projectTitle,
          winners_count: selectedIds.size,
          approved_application_ids: approvedIds,
          approved_applicant_names: approvedApplications.map(app => app.applicant_name),
          total_applications: rankedApplications.length,
          selection_method: 'ranked_by_score',
        },
      });

      toast({
        title: "Winners Approved",
        description: `Approved ${selectedIds.size} application${selectedIds.size > 1 ? "s" : ""}. Email notifications sent.`,
      });
      await refetch();
      // Invalidate queries to update the Projects list and winners indicator
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-winners-selected"] });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error?.message || "Failed to approve selected applications.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectOthers = async () => {
    if (!rankedApplications.length) return;
    const toReject = rankedApplications
      .map((app) => app.application_id)
      .filter((appId) => !selectedIds.has(appId));

    if (toReject.length === 0) {
      toast({
        title: "No applicants to reject",
        description: "All applications are currently selected.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateApplicationStatus(toReject, "rejected");

      // Send rejection emails to all rejected applicants
      const rejectedApplications = rankedApplications.filter((app) =>
        toReject.includes(app.application_id)
      );

      // Get project title for email
      const projectTitle = currentProject?.title || "the project";

      // Send emails in parallel (don't block on email failures)
      const emailPromises = rejectedApplications.map(async (app) => {
        if (!app.applicant_email || app.applicant_email === "No email") {
          console.warn(`Skipping email for application ${app.application_id}: no email address`);
          return;
        }

        try {
          // Use sendEmail directly to include applicationId (not in sendApplicationRejectedEmail signature)
          await sendEmail({
            to: app.applicant_email,
            type: "application_rejected",
            data: {
              recipientName: app.applicant_name,
              projectTitle,
              applicationId: app.application_id,
              statusMessage: "Thank you for your interest. Unfortunately, your application was not selected this time. We encourage you to apply for other opportunities.",
              actionUrl: `${window.location.origin}/projects`,
            },
          });
        } catch (emailError) {
          // Log but don't fail the rejection process
          console.error(
            `Failed to send rejection email to ${app.applicant_email}:`,
            emailError
          );
        }
      });

      // Wait for all emails (but don't fail if some fail)
      await Promise.allSettled(emailPromises);

      toast({
        title: "Applicants Rejected",
        description: `Rejected ${toReject.length} application${toReject.length > 1 ? "s" : ""}. Email notifications sent.`,
      });
      await refetch();
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error?.message || "Failed to reject applications.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<RankedApplication>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label="Select all applications"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label={`Select ${row.original.applicant_name}`}
              checked={selectedIds.has(row.original.application_id)}
              onChange={() => toggleSelection(row.original.application_id)}
              className="h-4 w-4"
            />
          </div>
        ),
      },
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
    [allSelected, selectedIds, rankedApplications, navigate]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Project Applications</h1>
        <p className="text-muted-foreground mt-1">
          Rank applicants by score and select winners.
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
                navigate(`/admin/projects/${value}/applications`);
                setSelectedIds(new Set());
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
              {hasWinnersSelected && (
                <Badge className="bg-success/10 text-success border-success/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Winners Selected
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Ranked Applications</CardTitle>
            <p className="text-sm text-muted-foreground">
              {hasWinnersSelected 
                ? "Winners have already been selected for this project." 
                : "Select winners and approve them based on scores."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={topCount}
                onChange={(event) => setTopCount(Number(event.target.value))}
                className="w-20"
              />
              <Button variant="outline" onClick={handleSelectTop} disabled={!rankedApplications.length}>
                Select Top
              </Button>
            </div>
            <Button 
              variant="default" 
              onClick={handleApproveSelected} 
              disabled={isSubmitting || !hasSelection || hasWinnersSelected}
              title={hasWinnersSelected ? "Winners have already been selected for this project" : ""}
            >
              Approve Selected
            </Button>
            <Button variant="outline" onClick={handleRejectOthers} disabled={isSubmitting || rankedApplications.length === 0}>
              Reject Others
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={!hasSelection}>
              Clear Selection
            </Button>
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
            onRefresh={() => refetch()}
            isRefreshing={isFetching || isLoading}
          />
        </CardContent>
      </Card>
      <Dialog open={!!scoreModalApp} onOpenChange={(open) => !open && setScoreModalApp(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reviewer Scores</DialogTitle>
            <DialogDescription>
              {scoreModalApp?.applicant_name} · Rank #{scoreModalApp?.rank_position}
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

