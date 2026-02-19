import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { useReviewerApplications } from "@/hooks/useReviewerApplications";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const ReviewerDashboard = () => {
  const navigate = useNavigate();
  const { data: applications = [], isLoading, error } = useReviewerApplications();

  // Calculate stats from real data
  const stats = useMemo(() => {
    const pending = applications.filter((app) => app.status === "pending").length;
    const approved = applications.filter((app) => app.status === "approved").length;
    const rejected = applications.filter((app) => app.status === "rejected").length;
    const total = applications.length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return {
      pending,
      approved,
      rejected,
      total,
      approvalRate,
    };
  }, [applications]);

  // Get recent applications (pending ones, sorted by date)
  const recentApplications = useMemo(() => {
    return applications
      .filter((app) => app.status === "pending")
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 5);
  }, [applications]);

  const statCards = [
    {
      title: "Pending Review",
      value: stats.pending,
      icon: Clock,
      description: "Applications awaiting review",
      className: "bg-warning/10 text-warning border-warning/20",
    },
    {
      title: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      description: "Total approved applications",
      className: "bg-success/10 text-success border-success/20",
    },
    {
      title: "Rejected",
      value: stats.rejected,
      icon: XCircle,
      description: "Total rejected applications",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    {
      title: "Total",
      value: stats.total,
      icon: FileText,
      description: "All applications",
      className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reviewer Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of applications and review statistics
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reviewer Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Overview of applications and review statistics
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
        <h1 className="text-2xl sm:text-3xl font-bold">Reviewer Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Overview of applications and review statistics
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={stat.className}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Review Performance</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your review statistics</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Total Applications</span>
                <span className="text-base sm:text-lg font-semibold">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Approval Rate</span>
                <span className="text-base sm:text-lg font-semibold">{stats.approvalRate}%</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs sm:text-sm text-muted-foreground">Pending Reviews</span>
                <span className="text-base sm:text-lg font-semibold">{stats.pending}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Recent Applications</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest submissions requiring review</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {recentApplications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm sm:text-base">No pending applications at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{app.applicantName}</p>
                      <p className="text-xs text-muted-foreground truncate">{app.projectTitle}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/reviewer/applications/${app.id}`)}
                      className="min-h-[44px] min-w-[44px] w-full sm:w-auto"
                    >
                      <Eye className="h-4 w-4 sm:mr-0" />
                      <span className="sm:hidden ml-2">View</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewerDashboard;

