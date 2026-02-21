import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Star,
} from "lucide-react";
import type { ApplicationAssignment, ReviewScore, ReviewAggregation } from "@/hooks/useReviewerAssignment";

interface AdminReviewSidebarProps {
  assignments: ApplicationAssignment[];
  reviewScores: ReviewScore[];
  reviewAggregation: ReviewAggregation | null | undefined;
  assignmentsLoading: boolean;
  scoresLoading: boolean;
  aggregationLoading: boolean;
}

const AdminReviewSidebar = ({
  assignments,
  reviewScores,
  reviewAggregation,
  assignmentsLoading,
  scoresLoading,
  aggregationLoading,
}: AdminReviewSidebarProps) => {
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
            <CardTitle className="text-base sm:text-lg">Reviewers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
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
            <CardTitle className="text-base sm:text-lg">Reviewers</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="text-sm text-muted-foreground">
              No reviewers assigned yet.
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default AdminReviewSidebar;

