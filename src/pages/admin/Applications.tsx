import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, CheckCircle, XCircle, Clock, X, ChevronDown, ChevronUp, UserCheck, UserX, MessageSquare } from "lucide-react";
import { useAdminApplications } from "@/hooks/useAdminApplications";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const AdminApplications = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [expandedApplications, setExpandedApplications] = useState<Set<string>>(new Set());

  const { data: applications = [], isLoading, error } = useAdminApplications();

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
              {filteredApplications.map((app) => {
                const isExpanded = expandedApplications.has(app.id);
                const hasReviewerDecisions = app.reviewerDecisions && app.reviewerDecisions.length > 0;
                
                return (
                  <div
                    key={app.id}
                    className="border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{app.applicantName}</h3>
                          {getStatusBadge(app.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span className="truncate">{app.projectTitle}</span>
                          <span className="whitespace-nowrap">Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
                          {app.reviewedByName && app.reviewedAt && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="whitespace-nowrap">
                                Final Decision: {app.status === "approved" ? "Approved" : app.status === "rejected" ? "Rejected" : "Reviewed"} by {app.reviewedByName} on {new Date(app.reviewedAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                          <span className="whitespace-nowrap">{app.fundingAmount}</span>
                          {hasReviewerDecisions && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="whitespace-nowrap">
                                {app.reviewerDecisions!.length} Reviewer{app.reviewerDecisions!.length !== 1 ? 's' : ''} Decision{app.reviewerDecisions!.length !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {hasReviewerDecisions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newExpanded = new Set(expandedApplications);
                              if (isExpanded) {
                                newExpanded.delete(app.id);
                              } else {
                                newExpanded.add(app.id);
                              }
                              setExpandedApplications(newExpanded);
                            }}
                            className="min-h-[44px] sm:min-h-0"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Hide Decisions
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Show Decisions
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/reviewer/applications/${app.id}`, { state: { fromAdmin: true } })}
                          title="View application details (review actions require reviewer account)"
                          className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                    
                    {/* Reviewer Decisions Section */}
                    {isExpanded && hasReviewerDecisions && (
                      <div className="border-t p-4 bg-muted/30">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm mb-3">Individual Reviewer Decisions</h4>
                          {app.reviewerDecisions!.map((decision, idx) => (
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
                          
                          {/* Final Decision Section */}
                          {app.reviewedByName && app.reviewedAt && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-sm">Final Decision</h4>
                                <Badge className={
                                  app.status === "approved" 
                                    ? "bg-success/10 text-success border-success/20"
                                    : app.status === "rejected"
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : ""
                                }>
                                  {app.status === "approved" ? "Approved" : app.status === "rejected" ? "Rejected" : app.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Made by: <span className="font-medium">{app.reviewedByName}</span></p>
                                <p>Date: {new Date(app.reviewedAt).toLocaleString()}</p>
                                {app.reviewNotes && (
                                  <div className="mt-2 p-2 bg-muted rounded">
                                    <span className="font-medium">Notes: </span>
                                    <span>{app.reviewNotes}</span>
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
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminApplications;

