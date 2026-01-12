import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";

const ReviewerDashboard = () => {
  // Mock data - replace with actual API calls
  const stats = {
    pending: 12,
    underReview: 5,
    approved: 48,
    rejected: 23,
    total: 88,
    avgReviewTime: "2.5 days",
  };

  const recentApplications = [
    {
      id: "1",
      applicantName: "Jane Doe",
      projectTitle: "AgriTech Innovation Fund",
      submittedAt: "2024-01-15",
      status: "pending",
    },
    {
      id: "2",
      applicantName: "John Smith",
      projectTitle: "Tech Startup Grant",
      submittedAt: "2024-01-14",
      status: "under_review",
    },
    {
      id: "3",
      applicantName: "Sarah Johnson",
      projectTitle: "FinTech for Financial Inclusion",
      submittedAt: "2024-01-13",
      status: "pending",
    },
  ];

  const statCards = [
    {
      title: "Pending Review",
      value: stats.pending,
      icon: Clock,
      description: "Applications awaiting review",
      className: "bg-warning/10 text-warning border-warning/20",
    },
    {
      title: "Under Review",
      value: stats.underReview,
      icon: FileText,
      description: "Currently being reviewed",
      className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reviewer Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of applications and review statistics
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className={stat.className}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Review Performance</CardTitle>
            <CardDescription>Your review statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Applications</span>
                <span className="text-lg font-semibold">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average Review Time</span>
                <span className="text-lg font-semibold">{stats.avgReviewTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Approval Rate</span>
                <span className="text-lg font-semibold">
                  {Math.round((stats.approved / stats.total) * 100)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest submissions requiring review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{app.applicantName}</p>
                    <p className="text-xs text-muted-foreground">{app.projectTitle}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-muted">
                    {app.status === "pending" ? "Pending" : "Under Review"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReviewerDashboard;

