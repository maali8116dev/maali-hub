import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Briefcase, TrendingUp, DollarSign, Clock, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRecentActivity } from "@/hooks/useActivityLogs";
import { format, formatDistanceToNow } from "date-fns";

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatActivityDescription = (activity: {
  actionType: string;
  entityType: string;
  description: string;
  userName?: string | null;
  metadata?: Record<string, unknown> | null;
}) => {
  const actor = activity.userName?.trim() || "A user";
  const meta = activity.metadata || {};
  const projectTitle = (meta.project_title as string) || (meta.opportunity_title as string);
  const applicantName = (meta.applicant_name as string) || (meta.full_legal_name as string);
  const reviewerName = meta.reviewer_name as string;

  if (activity.entityType === "application") {
    if (activity.actionType === "submit") {
      if (applicantName && projectTitle) return `${applicantName} submitted an application for "${projectTitle}".`;
      if (applicantName) return `${applicantName} submitted an application.`;
      return `${actor} submitted an application.`;
    }
    if (activity.actionType === "assign_reviewers") {
      const reviewerCount = meta.reviewer_count as number | undefined;
      if (reviewerCount) return `${actor} assigned ${reviewerCount} reviewer${reviewerCount === 1 ? "" : "s"} to an application.`;
      return `${actor} assigned reviewers to an application.`;
    }
    if (activity.actionType === "review") {
      if (reviewerName) return `${reviewerName} submitted a review.`;
      return `${actor} submitted a review.`;
    }
  }

  const cleanDescription = activity.description?.replace(/opportunity ID:\s*\d+/i, "an opportunity");
  if (cleanDescription && cleanDescription.trim().length > 0) {
    return cleanDescription;
  }

  return `${actor} ${activity.actionType.replace(/_/g, " ")} ${activity.entityType.replace(/_/g, " ")}.`;
};

const AdminDashboard = () => {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(10);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Overview of platform activity and statistics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalUsers.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  Registered users
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalProjects || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {stats?.activeProjects || 0} active opportunities
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalApplications.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  All time submissions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-warning hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.pendingApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  Awaiting review
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Approved</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.approvedApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  Successfully approved
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Rejected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.rejectedApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  Not approved
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Link to="/admin/opportunities">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Briefcase className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Manage Projects</span>
              </Button>
            </Link>
            <Link to="/admin/applications">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Review Apps</span>
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Manage Users</span>
              </Button>
            </Link>
            <Link to="/admin/activity-logs">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Activity className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Activity Logs</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Recent Activity</CardTitle>
          <Link to="/admin/activity-logs">
            <Button variant="ghost" size="sm" className="min-h-[44px] w-full sm:w-auto">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {activityLoading ? (
            <div className="space-y-3 sm:space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : !recentActivity || recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">No recent activity</p>
              <p className="text-xs text-muted-foreground">
                Activity will appear here as users interact with the platform
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">
                      {formatActivityDescription(activity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {toTitleCase(activity.actionType)} · {toTitleCase(activity.entityType)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;








