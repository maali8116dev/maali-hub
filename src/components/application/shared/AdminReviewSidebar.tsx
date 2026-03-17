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
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Star,
  X,
} from "lucide-react";
import type { ApplicationAssignment, ReviewScore, ReviewAggregation } from "@/hooks/useReviewerAssignment";

interface AdminReviewSidebarProps {
  assignments: ApplicationAssignment[];
  reviewScores: ReviewScore[];
  reviewAggregation: ReviewAggregation | null | undefined;
  assignmentsLoading: boolean;
  scoresLoading: boolean;
  aggregationLoading: boolean;
  applicationId?: string;
}

const AdminReviewSidebar = ({
  assignments,
  reviewScores,
  reviewAggregation,
  assignmentsLoading,
  scoresLoading,
  aggregationLoading,
  applicationId,
}: AdminReviewSidebarProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);

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
    enabled: !!applicationId && isManageOpen,
  });

  const setReviewersMutation = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error("Missing application id");
      if (selectedReviewerIds.length < 2) {
        throw new Error("Select 2 reviewers");
      }
      const unique = [...new Set(selectedReviewerIds)];
      if (unique.length < 2) throw new Error("Reviewers must be different");
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
        title: "Reviewers updated",
        description: "Assignments were updated successfully.",
      });
      setIsManageOpen(false);
    },
    onError: (e: unknown) => {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Could not update reviewers.",
        variant: "destructive",
      });
    },
  });

  const openManage = async () => {
    setIsManageOpen(true);
    setSelectedReviewerIds(assignments.slice(0, 2).map((a) => a.reviewer_id).filter(Boolean));
    await refetchEligible();
  };

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
            <CardTitle className="text-base sm:text-lg">Review Status</CardTitle>
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
            <CardTitle className="text-base sm:text-lg">Review Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Reviews:</span>
                <Badge variant="outline">
                  {reviewAggregation.total_reviews} / {assignments.length}
                </Badge>
              </div>
              {reviewAggregation.pending_reviewers > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending:</span>
                  <Badge className="bg-warning/10 text-warning border-warning/20">
                    <Clock className="h-3 w-3 mr-1" />
                    {reviewAggregation.pending_reviewers}
                  </Badge>
                </div>
              )}
              {reviewAggregation.average_score > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Score:</span>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">
                      {reviewAggregation.average_score.toFixed(1)} / 10
                    </span>
                  </div>
                </div>
              )}
              {reviewAggregation.recommendations && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations:</p>
                  <div className="space-y-1.5">
                    {reviewAggregation.recommendations.approve > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3 text-success" />
                          Approve
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
                          Reject
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
                          Request Info
                        </span>
                        <Badge className="bg-warning/10 text-warning border-warning/20 text-xs">
                          {reviewAggregation.recommendations.request_info}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : assignments.length > 0 ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Review Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-sm text-muted-foreground">
              {assignments.length} reviewer(s) assigned, no reviews submitted yet.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Reviewer Assignments */}
      {assignmentsLoading || scoresLoading ? (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Reviewers</CardTitle>
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
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Reviewers</CardTitle>
              {applicationId && (
                <Button variant="outline" size="sm" onClick={openManage}>
                  {assignments.length < 2 ? "Assign reviewer" : "Reassign"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {assignments.length < 2 && (
              <div className="text-xs text-warning">
                This application needs 2 reviewers. Only {assignments.length} assigned so far.
              </div>
            )}
            {assignments.map((assignment) => {
              const reviewerName = assignment.reviewer
                ? `${assignment.reviewer.first_name} ${assignment.reviewer.last_name}`.trim() || "Unknown Reviewer"
                : "Unknown Reviewer";
              const reviewScore = reviewScores.find((rs) => rs.reviewer_id === assignment.reviewer_id);
              const isCompleted = assignment.status === "completed" || !!reviewScore;

              return (
                <div key={assignment.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reviewerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isCompleted ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    ) : (
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        <Clock className="h-3 w-3 mr-1" />
                        {assignment.status === "in_progress" ? "In Progress" : "Pending"}
                      </Badge>
                    )}
                  </div>
                  {reviewScore && (
                    <div className="pt-2 border-t space-y-1.5">
                      {reviewScore.overall_score && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Score:</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-medium">
                              {reviewScore.overall_score.toFixed(1)} / 10
                            </span>
                          </div>
                        </div>
                      )}
                      {reviewScore.recommendation && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Recommendation:</span>
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
                            {reviewScore.recommendation.replace("_", " ")}
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
              <CardTitle className="text-base sm:text-lg">Reviewers</CardTitle>
              {applicationId && (
                <Button variant="outline" size="sm" onClick={openManage}>
                  Assign reviewers
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-sm text-muted-foreground">
              No reviewers assigned yet.
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign reviewers</DialogTitle>
            <DialogDescription>
              Select exactly 2 eligible reviewers. Add from the dropdown and remove with the × on each pill.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reviewers</label>
              <div className="flex flex-wrap gap-2 min-h-9 p-2 border rounded-md bg-muted/30">
                {selectedReviewerIds.map((id) => (
                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                    {reviewerName(id)}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeReviewer(id)}
                      aria-label={`Remove ${reviewerName(id)}`}
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
                      <SelectValue placeholder="Add reviewer..." />
                    </SelectTrigger>
                    <SelectContent className="z-[100]" position="popper">
                      {availableToAdd.map((r) => (
                        <SelectItem key={r.reviewer_id} value={r.reviewer_id}>
                          {`${r.first_name} ${r.last_name}`.trim() || r.reviewer_id} (workload {r.workload})
                        </SelectItem>
                      ))}
                      {availableToAdd.length === 0 && (
                        <div className="py-2 px-2 text-sm text-muted-foreground">No more eligible reviewers</div>
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
                Cancel
              </Button>
              <Button
                onClick={() => setReviewersMutation.mutate()}
                disabled={setReviewersMutation.isPending || selectedReviewerIds.length !== 2}
              >
                {setReviewersMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminReviewSidebar;









