import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Briefcase, TrendingUp, DollarSign, Clock, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useRecentActivity, type ActivityLog } from "@/hooks/useActivityLogs";
import { useFormattedDistance } from "@/hooks/useFormattedDistance";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

type DashboardT = TFunction<"dashboard">;

function ActivityTime({ date }: { date: string }) {
  const formatted = useFormattedDistance(date);
  return <span className="text-xs text-muted-foreground whitespace-nowrap">{formatted}</span>;
}

const getReviewerPart = (t: DashboardT, count?: number) => {
  if (count) {
    return t("adminDashboard.recentActivity.descriptions.reviewerPart", { count });
  }
  return t("adminDashboard.recentActivity.descriptions.reviewerPartGeneric");
};

const formatActivityDescription = (
  t: DashboardT,
  activity: {
    actionType: string;
    entityType: string;
    description: string;
    userName?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) => {
  const actor = activity.userName?.trim() || t("adminDashboard.recentActivity.fallbackActor");
  const meta = activity.metadata || {};
  const projectTitle = (meta.project_title as string) || (meta.opportunity_title as string);
  const applicantName = (meta.applicant_name as string) || (meta.full_legal_name as string);
  const reviewerName = meta.reviewer_name as string;

  if (activity.actionType === "submission_and_assignment") {
    const reviewerCount = meta.reviewer_count as number | undefined;
    const reviewerPart = getReviewerPart(t, reviewerCount);
    if (applicantName && projectTitle) {
      return t("adminDashboard.recentActivity.descriptions.combinedWithProject", {
        applicantName,
        projectTitle,
        reviewerPart,
      });
    }
    if (applicantName) {
      return t("adminDashboard.recentActivity.descriptions.combinedWithApplicant", {
        applicantName,
        reviewerPart,
      });
    }
    if (reviewerCount) {
      return t("adminDashboard.recentActivity.descriptions.combinedWithReviewers", { reviewerPart });
    }
    return t("adminDashboard.recentActivity.descriptions.combinedDefault");
  }

  if (activity.entityType === "application") {
    if (activity.actionType === "submit") {
      if (applicantName && projectTitle) {
        return t("adminDashboard.recentActivity.descriptions.applicationSubmitWithProject", {
          applicantName,
          projectTitle,
        });
      }
      if (applicantName) {
        return t("adminDashboard.recentActivity.descriptions.applicationSubmitWithApplicant", {
          applicantName,
        });
      }
      return t("adminDashboard.recentActivity.descriptions.applicationSubmitGeneric", { actor });
    }
    if (activity.actionType === "assign_reviewers") {
      const reviewerCount = meta.reviewer_count as number | undefined;
      if (reviewerCount) {
        return t("adminDashboard.recentActivity.descriptions.reviewersAssigned", { count: reviewerCount });
      }
      return t("adminDashboard.recentActivity.descriptions.reviewersAssignedGeneric");
    }
    if (activity.actionType === "review") {
      if (reviewerName) {
        return t("adminDashboard.recentActivity.descriptions.reviewSubmitted", { reviewerName });
      }
      return t("adminDashboard.recentActivity.descriptions.reviewSubmittedGeneric", { actor });
    }
  }

  const cleanDescription = activity.description?.replace(/opportunity ID:\s*\d+/i, "an opportunity");
  if (cleanDescription && cleanDescription.trim().length > 0) {
    return cleanDescription;
  }

  const action = t(`adminDashboard.recentActivity.actionTypes.${activity.actionType}`, {
    defaultValue: activity.actionType.replace(/_/g, " "),
  });
  const entity = t(`adminDashboard.recentActivity.entityTypes.${activity.entityType}`, {
    defaultValue: activity.entityType.replace(/_/g, " "),
  });

  return t("adminDashboard.recentActivity.genericAction", { actor, action, entity });
};

const getApplicationRef = (activity: ActivityLog) => {
  const meta = activity.metadata || {};
  return (
    (meta.application_id as string | undefined) ||
    (meta.app_id as string | undefined) ||
    activity.entityId ||
    ""
  );
};

const combineRecentActivities = (activities: ActivityLog[]) => {
  const combined: ActivityLog[] = [];
  let i = 0;

  while (i < activities.length) {
    const current = activities[i];
    const older = activities[i + 1];

    const canCombine =
      current?.entityType === "application" &&
      current?.actionType === "assign_reviewers" &&
      older?.entityType === "application" &&
      older?.actionType === "submit" &&
      getApplicationRef(current) !== "" &&
      getApplicationRef(current) === getApplicationRef(older);

    if (canCombine) {
      combined.push({
        ...current,
        actionType: "submission_and_assignment",
        description: "",
        metadata: {
          ...(older.metadata || {}),
          ...(current.metadata || {}),
          combined_event: true,
        },
      });
      i += 2;
      continue;
    }

    combined.push(current);
    i += 1;
  }

  return combined;
};

const getActivityTypeLabel = (t: DashboardT, activity: ActivityLog) => {
  if (activity.actionType === "submission_and_assignment") {
    return t("adminDashboard.recentActivity.combinedLabel");
  }
  const action = t(`adminDashboard.recentActivity.actionTypes.${activity.actionType}`, {
    defaultValue: activity.actionType.replace(/_/g, " "),
  });
  const entity = t(`adminDashboard.recentActivity.entityTypes.${activity.entityType}`, {
    defaultValue: activity.entityType.replace(/_/g, " "),
  });
  return `${action} · ${entity}`;
};

const AdminDashboard = () => {
  const { t } = useTranslation("dashboard");
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity(10);
  const displayActivity = recentActivity ? combineRecentActivities(recentActivity) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.pages.dashboard")}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t("adminDashboard.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.totalUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalUsers.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.registeredUsers")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.totalProjects")}</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalProjects || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.activeOpportunities", {
                    count: stats?.activeProjects || 0,
                  })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.totalApplications")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.totalApplications.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.allTimeSubmissions")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.pendingReviews")}</CardTitle>
            <Clock className="h-4 w-4 text-warning hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.pendingApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.awaitingReview")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.approved")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500 hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.approvedApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.successfullyApproved")}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t("adminDashboard.stats.rejected")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold">{stats?.rejectedApplications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                  {t("adminDashboard.stats.notApproved")}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("adminDashboard.quickActions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Link to="/admin/opportunities">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Briefcase className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t("adminDashboard.quickActions.manageProjects")}</span>
              </Button>
            </Link>
            <Link to="/admin/applications">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <FileText className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t("adminDashboard.quickActions.reviewApps")}</span>
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Users className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t("adminDashboard.quickActions.manageUsers")}</span>
              </Button>
            </Link>
            <Link to="/admin/activity-logs">
              <Button variant="outline" className="w-full min-h-[44px] text-xs sm:text-sm">
                <Activity className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">{t("adminDashboard.quickActions.activityLogs")}</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("adminDashboard.recentActivity.title")}</CardTitle>
          <Link to="/admin/activity-logs">
            <Button variant="ghost" size="sm" className="min-h-[44px] w-full sm:w-auto">
              {t("adminDashboard.recentActivity.viewAll")}
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
          ) : displayActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t("adminDashboard.recentActivity.emptyTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("adminDashboard.recentActivity.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {displayActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">
                      {formatActivityDescription(t, activity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getActivityTypeLabel(t, activity)}
                    </p>
                  </div>
                  <ActivityTime date={activity.createdAt} />
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
