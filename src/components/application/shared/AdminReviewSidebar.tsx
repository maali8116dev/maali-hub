import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Star,
  X,
} from "lucide-react";
import {
  useAddApplicationReviewer,
  suggestsTieBreakerReviewer,
  type ApplicationAssignment,
  type ReviewScore,
  type ReviewAggregation,
} from "@/hooks/useReviewerAssignment";
import { useUpdateApplicationStatus } from "@/hooks/useUpdateApplicationStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_REVIEWERS_PER_APPLICATION = 5;

interface AdminReviewSidebarProps {
  assignments: ApplicationAssignment[];
  reviewScores: ReviewScore[];
  reviewAggregation: ReviewAggregation | null | undefined;
  assignmentsLoading: boolean;
  scoresLoading: boolean;
  aggregationLoading: boolean;
  applicationId?: string;
  applicationStatus?: string;
}

const AdminReviewSidebar = ({
  assignments,
  reviewScores,
  reviewAggregation,
  assignmentsLoading,
  scoresLoading,
  aggregationLoading,
  applicationId,
  applicationStatus,
}: AdminReviewSidebarProps) => {
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard", "common"]);
  const queryClient = useQueryClient();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [addReviewerId, setAddReviewerId] = useState("");
  const addReviewerMutation = useAddApplicationReviewer();
  const updateStatusMutation = useUpdateApplicationStatus();

  const { data: eligibleReviewers = [], isLoading: eligibleLoading, refetch: refetchEligible } = useQuery({
    queryKey: ["eligible-reviewers-for-application", applicationId],
    queryFn: async () => {
      if (!applicationId) return [];
      const { data, error } = await supabase.rpc("get_eligible_reviewers_for_application" as any, {
        p_application_id: applicationId,
      });
      if (error) throw error;
      return (data || []) as Array<{
        reviewer_id: string;
        first_name: string;
        last_name: string;
        workload: number;
      }>;
    },
    enabled: !!applicationId && (isManageOpen || isAddOpen),
  });

  const showTieBreakerHint =
    !!reviewAggregation &&
    suggestsTieBreakerReviewer(reviewAggregation, assignments.length, MAX_REVIEWERS_PER_APPLICATION);

  const reviewsComplete =
    !!reviewAggregation &&
    assignments.length > 0 &&
    reviewAggregation.pending_reviewers === 0 &&
    reviewAggregation.total_reviews >= assignments.length;

  const canSetFinalStatus =
    !!applicationId && reviewsComplete && applicationStatus === "under_review";

  const handleFinalStatus = async (status: "approved" | "rejected") => {
    if (!applicationId) return;
    try {
      await updateStatusMutation.mutateAsync({
        applicationIds: [applicationId],
        status,
      });
      toast({
        title: status === "approved" ? t("applications.detail.review.toastApproved") : t("applications.detail.review.toastRejected"),
      });
    } catch (err) {
      toast({
        title: t("applications.detail.review.toastStatusError"),
        description: err instanceof Error ? err.message : t("applications.detail.review.toastTryAgain"),
        variant: "destructive",
      });
    }
  };

  const setReviewersMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error("Missing application id");
      if (selectedReviewerIds.length < 2) {
        throw new Error(t("applications.detail.review.errors.selectTwoReviewers"));
      }
      const unique = [...new Set(selectedReviewerIds)];
      if (unique.length < 2) throw new Error(t("applications.detail.review.errors.reviewersMustDiffer"));
      const { error } = await supabase.rpc("admin_set_application_reviewers" as any, {
        p_application_id: applicationId,
        p_reviewer_ids: selectedReviewerIds.slice(0, 2),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: ["application-assignments", applicationId] });
        queryClient.invalidateQueries({ queryKey: ["review-aggregation", applicationId] });
      }
      toast({
        title: t("applications.detail.review.toastReviewersUpdated"),
        description: t("applications.detail.review.toastReviewersUpdatedDesc"),
      });
      setIsManageOpen(false);
    },
    onError: (e: unknown) => {
      toast({
        title: t("applications.detail.review.toastUpdateFailed"),
        description: e instanceof Error ? e.message : t("applications.detail.review.toastTryAgain"),
        variant: "destructive",
      });
    },
  });

  const openManage = async () => {
    setIsManageOpen(true);
    setSelectedReviewerIds(assignments.slice(0, 2).map((a) => a.reviewer_id).filter(Boolean));
    await refetchEligible();
  };

  const openAdd = async () => {
    setIsAddOpen(true);
    setAddReviewerId("");
    await refetchEligible();
  };

  const assignedIds = new Set(assignments.map((a) => a.reviewer_id));
  const eligibleNotAssigned = eligibleReviewers.filter((r) => !assignedIds.has(r.reviewer_id));

  const addReviewer = (reviewerId: string) => {
    if (selectedReviewerIds.includes(reviewerId) || selectedReviewerIds.length >= 2) return;
    setSelectedReviewerIds((prev) => [...prev, reviewerId]);
  };
  const removeReviewer = (reviewerId: string) => {
    setSelectedReviewerIds((prev) => prev.filter((id) => id !== reviewerId));
  };
  const reviewerName = (id: string) => {
    const r = eligibleReviewers.find((x) => x.reviewer_id === id);
    if (r) return `${r.first_name} ${r.last_name}`.trim() || id;
    const a = assignments.find((x) => x.reviewer_id === id);
    if (a?.reviewer) return `${a.reviewer.first_name} ${a.reviewer.last_name}`.trim() || id;
    return id;
  };
  const availableToAdd = eligibleReviewers.filter((r) => !selectedReviewerIds.includes(r.reviewer_id));

  return (
    <>
      {/* Review Summary */}
      {aggregationLoading ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : reviewAggregation ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("applications.detail.review.totalReviews")}</span>
                <Badge variant="outline">
                  {reviewAggregation.total_reviews} / {assignments.length}
                </Badge>
              </div>
              {reviewAggregation.pending_reviewers > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("applications.detail.review.pending")}</span>
                  <Badge className="bg-warning/10 text-warning border-warning/20">
                    <Clock className="h-3 w-3 mr-1" />
                    {reviewAggregation.pending_reviewers}
                  </Badge>
                </div>
              )}
              {reviewAggregation.average_score > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("applications.detail.review.averageScore")}</span>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">
                      {t("applications.detail.review.scoreOutOf", { score: reviewAggregation.average_score.toFixed(1) })}
                    </span>
                  </div>
                </div>
              )}
              {reviewAggregation.recommendations && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("applications.detail.review.recommendations")}</p>
                  <div className="space-y-1.5">
                    {reviewAggregation.recommendations.approve > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3 text-success" />
                          {t("common:status.recommendation.approve")}
                        </span>
                        <Badge className="bg-success/10 text-success border-success/20 text-xs">
                          {reviewAggregation.recommendations.approve}
                        </Badge>
                      </div>
                    )}
                    {reviewAggregation.recommendations.reject > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="h-3 w-3 text-destructive" />
                          {t("common:status.recommendation.reject")}
                        </span>
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                          {reviewAggregation.recommendations.reject}
                        </Badge>
                      </div>
                    )}
                    {reviewAggregation.recommendations.request_info > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3 text-warning" />
                          {t("common:status.recommendation.request_info")}
                        </span>
                        <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                          {reviewAggregation.recommendations.request_info}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {showTieBreakerHint && assignments.length < MAX_REVIEWERS_PER_APPLICATION && (
                <p className="text-xs text-warning pt-2 border-t">
                  {t("applications.detail.review.tieBreakerHint", { max: MAX_REVIEWERS_PER_APPLICATION })}
                </p>
              )}
              {applicationStatus === "under_review" &&
                reviewAggregation.pending_reviewers > 0 && (
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    {t("applications.detail.review.underReviewProgress", {
                      completed: reviewAggregation.total_reviews,
                      total: assignments.length,
                    })}
                  </p>
                )}
              {canSetFinalStatus && (
                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t("applications.detail.review.allReviewsIn")}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1 min-h-[44px]"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => handleFinalStatus("approved")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t("applications.detail.review.approve")}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex-1 min-h-[44px]"
                          disabled={updateStatusMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t("applications.detail.review.reject")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("applications.detail.review.rejectDialogTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("applications.detail.review.rejectDialogDescription")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("applications.detail.review.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleFinalStatus("rejected")}
                          >
                            {t("applications.detail.review.reject")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : assignments.length > 0 ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-sm text-muted-foreground">
              {t("applications.detail.review.reviewersAssignedNoReviews", { count: assignments.length })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Reviewer Assignments */}
      {assignmentsLoading || scoresLoading ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.reviewersTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : assignments.length > 0 ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.reviewersTitle")}</CardTitle>
              {applicationId && (
                <div className="flex gap-2">
                  {assignments.length >= 2 && assignments.length < MAX_REVIEWERS_PER_APPLICATION && (
                    <Button variant="outline" size="sm" onClick={openAdd}>
                      {t("applications.detail.review.addReviewer")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={openManage}>
                    {assignments.length < 2 ? t("applications.detail.review.assignReviewers") : t("applications.detail.review.reassign")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {assignments.length < 2 && (
              <div className="text-xs text-warning">
                {t("applications.detail.review.needsTwoReviewers", { count: assignments.length })}
              </div>
            )}
            {assignments.map((assignment) => {
              const displayReviewerName = assignment.reviewer
                ? `${assignment.reviewer.first_name} ${assignment.reviewer.last_name}`.trim() || t("applications.detail.review.unknownReviewer")
                : t("applications.detail.review.unknownReviewer");
              const reviewScore = reviewScores.find((rs) => rs.reviewer_id === assignment.reviewer_id);
              const isCompleted = assignment.status === "completed" || !!reviewScore;

              return (
                <div key={assignment.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{displayReviewerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("applications.detail.review.assignedDate", {
                          date: new Date(assignment.assigned_at).toLocaleDateString(),
                        })}
                      </p>
                    </div>
                    {isCompleted ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t("common:status.reviewAssignment.completed")}
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        <Clock className="h-3 w-3 mr-1" />
                        {t(`common:status.reviewAssignment.${assignment.status === "in_progress" ? "in_progress" : "pending"}`)}
                      </Badge>
                    )}
                  </div>
                  {reviewScore && (
                    <div className="pt-2 border-t space-y-1.5">
                      {reviewScore.overall_score && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">{t("applications.detail.review.score")}</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-medium">
                              {t("applications.detail.review.scoreOutOf", { score: reviewScore.overall_score.toFixed(1) })}
                            </span>
                          </div>
                        </div>
                      )}
                      {reviewScore.recommendation && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">{t("applications.detail.review.recommendation")}</span>
                          <Badge
                            variant="outline"
                            className={
                              reviewScore.recommendation === "approve"
                                ? "bg-success/10 text-success border-success/20"
                                : reviewScore.recommendation === "reject"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-warning/10 text-warning border-warning/20"
                            }
                          >
                            {reviewScore.recommendation === "approve" && <CheckCircle className="h-3 w-3 mr-1" />}
                            {reviewScore.recommendation === "reject" && <XCircle className="h-3 w-3 mr-1" />}
                            {reviewScore.recommendation === "request_info" && <AlertCircle className="h-3 w-3 mr-1" />}
                            {t(`common:status.recommendation.${reviewScore.recommendation}`)}
                          </Badge>
                        </div>
                      )}
                      {reviewScore.comments && (
                        <div className="pt-1">
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {reviewScore.comments}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">{t("applications.detail.review.reviewersTitle")}</CardTitle>
              {applicationId && (
                <Button variant="outline" size="sm" onClick={openManage}>
                  {t("applications.detail.review.assignReviewers")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-sm text-muted-foreground">
              {t("applications.detail.review.noReviewersAssigned")}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("applications.detail.review.assignDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("applications.detail.review.assignDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("applications.detail.review.reviewersLabel")}</label>
              <div className="flex flex-wrap gap-2 min-h-9 p-2 border rounded-md bg-muted/30">
                {selectedReviewerIds.map((id) => (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                    {reviewerName(id)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeReviewer(id)}
                      aria-label={t("applications.detail.review.removeReviewerAria", { name: reviewerName(id) })}
                    />
                  </Badge>
                ))}
                {selectedReviewerIds.length < 2 && (
                  <Select
                    value=""
                    onValueChange={(v) => v && addReviewer(v)}
                    disabled={eligibleLoading || setReviewersMutation.isPending}
                  >
                    <SelectTrigger className="w-[180px] border-0 bg-transparent shadow-none focus:ring-0 h-8">
                      <SelectValue placeholder={t("applications.detail.review.addReviewerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent className="z-[100]" position="popper">
                      {availableToAdd.map((r) => (
                        <SelectItem key={r.reviewer_id} value={r.reviewer_id}>
                          {`${r.first_name} ${r.last_name}`.trim() || r.reviewer_id} ({t("applications.detail.review.workload", { count: r.workload })})
                        </SelectItem>
                      ))}
                      {availableToAdd.length === 0 && (
                        <div className="py-2 px-2 text-sm text-muted-foreground">{t("applications.detail.review.noEligibleReviewers")}</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsManageOpen(false)}
                disabled={setReviewersMutation.isPending}
              >
                {t("applications.detail.review.cancel")}
              </Button>
              <Button
                onClick={() => setReviewersMutation.mutate()}
                disabled={setReviewersMutation.isPending || selectedReviewerIds.length !== 2}
              >
                {setReviewersMutation.isPending ? t("applications.detail.review.saving") : t("applications.detail.review.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("applications.detail.review.addDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("applications.detail.review.addDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={addReviewerId}
              onValueChange={setAddReviewerId}
              disabled={eligibleLoading || addReviewerMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("applications.detail.review.chooseReviewerPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="z-[100]" position="popper">
                {eligibleNotAssigned.map((r) => (
                  <SelectItem key={r.reviewer_id} value={r.reviewer_id}>
                    {`${r.first_name} ${r.last_name}`.trim() || r.reviewer_id} ({t("applications.detail.review.workload", { count: r.workload })})
                  </SelectItem>
                ))}
                {eligibleNotAssigned.length === 0 && (
                  <div className="py-2 px-2 text-sm text-muted-foreground">
                    No more eligible reviewers
                  </div>
                )}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={addReviewerMutation.isPending}>
                {t("applications.detail.review.cancel")}
              </Button>
              <Button
                disabled={!addReviewerId || addReviewerMutation.isPending}
                onClick={() => {
                  if (!applicationId || !addReviewerId) return;
                  addReviewerMutation.mutate(
                    { applicationId, reviewerId: addReviewerId },
                    {
                      onSuccess: () => {
                        toast({
                          title: t("applications.detail.review.toastReviewerAdded"),
                          description: t("applications.detail.review.toastReviewerAddedDesc"),
                        });
                        setIsAddOpen(false);
                      },
                      onError: (e: unknown) => {
                        toast({
                          title: t("applications.detail.review.toastAddReviewerFailed"),
                          description: e instanceof Error ? e.message : t("applications.detail.review.toastTryAgain"),
                          variant: "destructive",
                        });
                      },
                    },
                  );
                }}
              >
                {addReviewerMutation.isPending ? t("applications.detail.review.adding") : t("applications.detail.review.addReviewer")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminReviewSidebar;









