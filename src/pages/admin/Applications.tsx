import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, CheckCircle, XCircle, Clock, X, ChevronDown, ChevronUp, UserCheck, UserX, MessageSquare } from "lucide-react";
import { useAdminApplications } from "@/hooks/useAdminApplications";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApplicationAssignments,
  useReviewAggregation,
  useDecisionEngine,
} from '@/hooks/useReviewerAssignment';

// Helper function to get status badge
const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const AdminApplications = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [expandedApplications, setExpandedApplications] = useState<Set<string>>(new Set());

  const { data: applications = [], isLoading, error } = useAdminApplications();

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || app.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Applications</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage all submitted applications
          </p>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Applications</h1>
          <p className="text-muted-foreground mt-2">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading applications: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          View all submitted applications. To review applications, please use a reviewer account.
        </p>
      </div>

      {/* Role Separation Notice */}
      {!bannerDismissed && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-xs sm:text-sm mb-1">Role Separation Policy</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Administrative accounts can view applications but cannot approve, reject, or request changes. 
                  This ensures proper separation of concerns, clear accountability, and accurate audit trails. 
                  To perform review actions, please use a reviewer account.
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="flex-shrink-0 p-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors min-h-[44px] sm:min-h-0"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
              ].map((filter) => (
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
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Applications ({filteredApplications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No applications found.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredApplications.map((app) => (
                <ApplicationReviewCard
                  key={app.id}
                  application={app}
                  expandedApplications={expandedApplications}
                  setExpandedApplications={setExpandedApplications}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Application Review Card Component with full review management features
const ApplicationReviewCard = ({
  application,
  expandedApplications,
  setExpandedApplications,
  navigate,
}: {
  application: any;
  expandedApplications: Set<string>;
  setExpandedApplications: (set: Set<string>) => void;
  navigate: (path: string, options?: any) => void;
}) => {
  const isExpanded = expandedApplications.has(application.id);
  const hasReviewerDecisions = application.reviewerDecisions && application.reviewerDecisions.length > 0;
  
  // Fetch review assignment data
  const { data: assignments = [] } = useApplicationAssignments(application.id);
  const { data: aggregation } = useReviewAggregation(application.id, assignments.length);
  const { data: decision } = useDecisionEngine(application.id, assignments.length || 2);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showDecisions, setShowDecisions] = useState(false);

  const toggleExpanded = () => {
    const newExpanded = new Set(expandedApplications);
    if (isExpanded) {
      newExpanded.delete(application.id);
    } else {
      newExpanded.add(application.id);
    }
    setExpandedApplications(newExpanded);
  };

  return (
    <div className="border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <h3 className="font-semibold text-sm sm:text-base truncate">{application.applicantName}</h3>
            {getStatusBadge(application.status)}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <span className="truncate">{application.projectTitle}</span>
            <span className="whitespace-nowrap">Submitted: {new Date(application.submittedAt).toLocaleDateString()}</span>
            {application.reviewedByName && application.reviewedAt && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">
                  Final Decision: {application.status === "approved" ? "Approved" : application.status === "rejected" ? "Rejected" : "Reviewed"} by {application.reviewedByName} on {new Date(application.reviewedAt).toLocaleDateString()}
                </span>
              </>
            )}
            <span className="whitespace-nowrap">{application.fundingAmount}</span>
            {assignments.length > 0 && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">
                  {assignments.length} Reviewer{assignments.length !== 1 ? 's' : ''} Assigned
                </span>
              </>
            )}
            {hasReviewerDecisions && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">
                  {application.reviewerDecisions!.length} Review{application.reviewerDecisions!.length !== 1 ? 's' : ''} Submitted
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(hasReviewerDecisions || assignments.length > 0 || aggregation) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="min-h-[44px] sm:min-h-0"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Show Details
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/reviewer/applications/${application.id}`, { state: { fromAdmin: true } })}
            title="View application details (review actions require reviewer account)"
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        </div>
      </div>
      
      {/* Expanded Review Details Section */}
      {isExpanded && (
        <div className="border-t p-4 bg-muted/30">
          <div className="space-y-4">
            {/* Assigned Reviewers Section */}
            {assignments.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Assigned Reviewers:</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {assignments.map((assignment: any) => (
                    <Badge key={assignment.id} variant="outline">
                      {assignment.reviewer?.first_name} {assignment.reviewer?.last_name}
                      <span className="ml-2 text-xs">({assignment.status})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Review Aggregation Section */}
            {aggregation && (
              <div className="space-y-3">
                <div className="p-3 bg-background border rounded-lg">
                  <p className="text-sm font-medium mb-2">Review Summary:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Average Score:</span>
                      <span className="ml-2 font-semibold">
                        {aggregation.average_score.toFixed(1)}/10
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Approve:</span>
                      <span className="ml-2 font-semibold text-success">
                        {aggregation.recommendations.approve}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reject:</span>
                      <span className="ml-2 font-semibold text-destructive">
                        {aggregation.recommendations.reject}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Variance:</span>
                      {aggregation.score_variance !== null ? (
                        <>
                          <span className={`ml-2 font-semibold ${
                            aggregation.score_variance > 1.5 ? 'text-warning' : 'text-success'
                          }`}>
                            {aggregation.score_variance.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {aggregation.score_variance > 1.5 ? '(High disagreement)' : '(Agreement)'}
                          </span>
                        </>
                      ) : (
                        <span className="ml-2 font-semibold text-muted-foreground">
                          N/A (need 2+ reviews)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Reviews:</span>
                      <span className="ml-2 font-semibold">
                        {aggregation.total_reviews}
                        {aggregation.pending_reviewers > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({aggregation.pending_reviewers} pending)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Decision Engine Recommendation */}
                {decision && (
                  <div className="p-3 border rounded-lg bg-background">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Decision Engine Recommendation:</p>
                      <Badge className={
                        decision.recommendedDecision === 'approve' 
                          ? 'bg-success/10 text-success border-success/20'
                          : decision.recommendedDecision === 'reject'
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      }>
                        {decision.recommendedDecision.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="font-semibold">{(decision.confidence * 100).toFixed(0)}%</span>
                        {decision.canAutoApprove && (
                          <Badge variant="outline" className="text-xs">Can Auto-Approve</Badge>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Reasoning:</p>
                        <ul className="text-xs space-y-1 list-disc list-inside">
                          {decision.reasoning.map((reason: string, idx: number) => (
                            <li key={idx} className="text-muted-foreground">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Per-Criterion Metrics */}
                {(Object.keys(aggregation.per_criterion_averages).length > 0 || Object.keys(aggregation.per_criterion_variances).length > 0) && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMetrics(!showMetrics)}
                      className="text-xs"
                    >
                      {showMetrics ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide Per-Criterion Metrics
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Show Per-Criterion Metrics
                        </>
                      )}
                    </Button>
                    
                    {showMetrics && (
                      <div className="mt-2 p-3 bg-background border rounded-lg">
                        <p className="text-xs font-medium mb-2">Per-Criterion Analysis:</p>
                        <div className="space-y-2">
                          {Object.entries(aggregation.per_criterion_averages).map(([criterion, avg]) => (
                            <div key={criterion} className="text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-medium capitalize">{criterion}:</span>
                                <div className="flex items-center gap-2">
                                  <span>Avg: {avg.toFixed(2)}/10</span>
                                  <span className="text-muted-foreground">
                                    (Var: {aggregation.per_criterion_variances[criterion]?.toFixed(2) || '0.00'})
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Individual Reviewer Decisions */}
                {aggregation.scores && aggregation.scores.length > 0 && (
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDecisions(!showDecisions)}
                      className="text-xs"
                    >
                      {showDecisions ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide Individual Decisions
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Show Individual Decisions ({aggregation.scores.length})
                        </>
                      )}
                    </Button>
                    
                    {showDecisions && (
                      <div className="mt-2 space-y-2">
                        {aggregation.scores.map((score: any) => {
                          const reviewerName = score.reviewer
                            ? `${score.reviewer.first_name || ''} ${score.reviewer.last_name || ''}`.trim() || 'Unknown Reviewer'
                            : 'Unknown Reviewer';
                          
                          return (
                            <div key={score.id} className="p-3 bg-background border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{reviewerName}</span>
                                  {score.recommendation === 'approve' && (
                                    <Badge className="bg-success/10 text-success border-success/20">
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Approve
                                    </Badge>
                                  )}
                                  {score.recommendation === 'reject' && (
                                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                      <UserX className="h-3 w-3 mr-1" />
                                      Reject
                                    </Badge>
                                  )}
                                  {score.recommendation === 'request_info' && (
                                    <Badge variant="secondary">
                                      <MessageSquare className="h-3 w-3 mr-1" />
                                      Request Info
                                    </Badge>
                                  )}
                                  {!score.recommendation && (
                                    <Badge variant="outline">No Recommendation</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {score.submitted_at 
                                    ? new Date(score.submitted_at).toLocaleString()
                                    : 'Not submitted'}
                                </div>
                              </div>
                              {score.overall_score !== null && (
                                <div className="text-sm text-muted-foreground mb-1">
                                  Overall Score: <span className="font-semibold">{score.overall_score.toFixed(1)}/10</span>
                                </div>
                              )}
                              {score.comments && (
                                <div className="text-sm mt-2 p-2 bg-muted rounded">
                                  <span className="font-medium">Comments: </span>
                                  <span className="text-muted-foreground">{score.comments}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Fallback: Show reviewer decisions from useAdminApplications if no aggregation */}
            {!aggregation && hasReviewerDecisions && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm mb-3">Individual Reviewer Decisions</h4>
                {application.reviewerDecisions!.map((decision: any, idx: number) => (
                  <div key={idx} className="p-3 bg-background border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{decision.reviewerName}</span>
                        {decision.recommendation === 'approve' && (
                          <Badge className="bg-success/10 text-success border-success/20">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Approve
                          </Badge>
                        )}
                        {decision.recommendation === 'reject' && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                            <UserX className="h-3 w-3 mr-1" />
                            Reject
                          </Badge>
                        )}
                        {decision.recommendation === 'request_info' && (
                          <Badge variant="secondary">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Request Info
                          </Badge>
                        )}
                        {!decision.recommendation && (
                          <Badge variant="outline">No Recommendation</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {decision.submittedAt 
                          ? new Date(decision.submittedAt).toLocaleString()
                          : 'Not submitted'}
                      </div>
                    </div>
                    {decision.overallScore !== null && (
                      <div className="text-sm text-muted-foreground mb-1">
                        Overall Score: <span className="font-semibold">{decision.overallScore.toFixed(1)}/10</span>
                      </div>
                    )}
                    {decision.comments && (
                      <div className="text-sm mt-2 p-2 bg-muted rounded">
                        <span className="font-medium">Comments: </span>
                        <span className="text-muted-foreground">{decision.comments}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Final Decision Section */}
            {application.reviewedByName && application.reviewedAt && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-sm">Final Decision</h4>
                  <Badge className={
                    application.status === "approved" 
                      ? "bg-success/10 text-success border-success/20"
                      : application.status === "rejected"
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : ""
                  }>
                    {application.status === "approved" ? "Approved" : application.status === "rejected" ? "Rejected" : application.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Made by: <span className="font-medium">{application.reviewedByName}</span></p>
                  <p>Date: {new Date(application.reviewedAt).toLocaleString()}</p>
                  {application.reviewNotes && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <span className="font-medium">Notes: </span>
                      <span>{application.reviewNotes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;

