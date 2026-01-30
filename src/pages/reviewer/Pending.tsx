import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Clock, AlertCircle } from "lucide-react";
import { useAdminApplications } from "@/hooks/useAdminApplications";
import { Skeleton } from "@/components/ui/skeleton";

const ReviewerPending = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: applications = [], isLoading, error } = useAdminApplications();

  // Filter and process pending applications
  const pendingApplications = useMemo(() => {
    return applications
      .filter((app) => app.status === "pending")
      .map((app) => {
        const submittedDate = new Date(app.submittedAt);
        const today = new Date();
        const daysPending = Math.floor(
          (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: app.id,
          applicantName: app.applicantName,
          projectTitle: app.projectTitle,
          submittedAt: app.submittedAt,
          fundingAmount: app.fundingAmount,
          daysPending,
        };
      });
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return pendingApplications.filter(
      (app) =>
        app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.projectTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingApplications, searchQuery]);

  // Sort by days pending (oldest first)
  const sortedApplications = useMemo(() => {
    return [...filteredApplications].sort((a, b) => b.daysPending - a.daysPending);
  }, [filteredApplications]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pending Review</h1>
          <p className="text-muted-foreground mt-2">Applications awaiting your review</p>
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
          <h1 className="text-3xl font-bold">Pending Review</h1>
          <p className="text-muted-foreground mt-2">Applications awaiting your review</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pending Review</h1>
        <p className="text-muted-foreground mt-2">
          Applications awaiting your review ({pendingApplications.length})
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pending applications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Priority Alert */}
      {sortedApplications.some((app) => app.daysPending >= 5) && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium">Applications pending for 5+ days</p>
                <p className="text-sm text-muted-foreground">
                  Please prioritize reviewing these applications
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Applications ({sortedApplications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedApplications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending applications found.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedApplications.map((app) => (
                <div
                  key={app.id}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                    app.daysPending >= 5 ? "border-warning/50 bg-warning/5" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{app.applicantName}</h3>
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        <Clock className="h-3 w-3 mr-1" />
                        {app.daysPending} {app.daysPending === 1 ? "day" : "days"} pending
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="font-medium">{app.projectTitle}</span>
                      <span>•</span>
                      <span>Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{app.fundingAmount}</span>
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate(`/reviewer/applications/${app.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Start Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerPending;

