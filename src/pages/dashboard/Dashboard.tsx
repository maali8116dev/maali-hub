import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle, TrendingUp, Plus, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStatsSkeleton, ApplicationListSkeleton } from "@/components/ui/skeletons";
import { useApplications, type ApplicationWithOpportunity } from "@/hooks/useApplications";
import { useUserDashboardStats } from "@/hooks/useUserDashboardStats";
import { useProfile } from "@/hooks/useProfile";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { ProfileSetupWizard } from "@/components/ProfileSetupWizard";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { formatDate } from "@/lib/dateUtils";
import { getApplicationStatusBadgeClassName } from "@/lib/statusBadges";

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'dashboard']);
  const { data: applications, isLoading: isLoadingApplications } = useApplications();
  const { data: dashboardStats, isLoading: isLoadingDashboardStats } = useUserDashboardStats();
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { isIncomplete, completionPercentage } = useProfileCompletion();
  const { user } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  // Clear the justSignedUp flag when component mounts
  useEffect(() => {
    localStorage.removeItem('justSignedUp');
  }, []);

  // Check if prompt was dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('profilePromptDismissed');
    setDismissedPrompt(dismissed === 'true');
  }, []);

  // Use RPC stats (more efficient) with fallback to calculated stats
  const stats = useMemo(() => {
    if (dashboardStats) {
      return {
        totalApplications: dashboardStats.totalApplications,
        pending: dashboardStats.pendingApplications,
        approved: dashboardStats.approvedApplications,
        rejected: dashboardStats.rejectedApplications,
      };
    }
    // Fallback to calculated stats from applications (for backward compatibility)
    if (!applications) {
      return { totalApplications: 0, pending: 0, approved: 0, rejected: 0 };
    }
    return {
      totalApplications: applications.length,
      pending: applications.filter((app) => app.status === "pending").length,
      approved: applications.filter((app) => app.status === "approved").length,
      rejected: applications.filter((app) => app.status === "rejected").length,
    };
  }, [dashboardStats, applications]);

  // Get recent applications (last 3)
  const recentApplications = useMemo(() => {
    if (!applications) return [];
    return applications.slice(0, 3);
  }, [applications]);

  // Calculate profile completion percentage
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    
    const fields = [
      profile.firstName,
      profile.lastName,
      profile.bio,
      profile.country,
      profile.businessName,
      profile.businessSector,
      profile.avatarUrl,
    ];
    
    const filledFields = fields.filter((field) => field && field.trim() !== "").length;
    return Math.round((filledFields / fields.length) * 100);
  }, [profile]);

  const getStatusBadge = (status: string) => {
    return getApplicationStatusBadgeClassName(status);
  };

  const isLoadingStats = isLoadingApplications || isLoadingDashboardStats;

  const handleDismissPrompt = () => {
    setDismissedPrompt(true);
    localStorage.setItem('profilePromptDismissed', 'true');
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    setDismissedPrompt(true);
    localStorage.setItem('profilePromptDismissed', 'true');
  };

  return (
    <div className="space-y-6">
      {/* Profile Setup Wizard */}
      <ProfileSetupWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={handleWizardComplete}
      />

      {/* Profile Completion Prompt */}
      {isIncomplete && !dismissedPrompt && !showWizard && (
        <Alert className="border-primary/50 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <AlertTitle>{t('profileWizard.completionPrompt')}</AlertTitle>
              <AlertDescription className="mt-2">
                {t('profileWizard.description')} ({completionPercentage}% {t('profileWizard.complete')})
              </AlertDescription>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowWizard(true)}
                >
                  {t('profileWizard.title')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismissPrompt}
                >
                  {t('profileWizard.skip')}
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismissPrompt}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard:dashboard.title')}</h1>
          <HelpTooltip 
            content={t('dashboard:dashboard.helpTooltip')}
            side="right"
          />
        </div>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t('dashboard:dashboard.welcome')}
        </p>
      </div>

      {/* Onboarding Checklist */}
      {!dismissedPrompt && (
        <OnboardingChecklist compact={false} />
      )}

      {/* Profile completion tip */}
      {isIncomplete && profileCompletion < 50 && !dismissedPrompt && (
        <InAppTip
          id="profile-completion-tip"
          type="warning"
          title={t('dashboard:dashboard.profileTip.title')}
          description={t('dashboard:dashboard.profileTip.description', { percentage: profileCompletion })}
          action={{
            label: t('dashboard:dashboard.profileTip.action'),
            onClick: () => setShowWizard(true),
          }}
        />
      )}

      {/* Stats Cards */}
      {isLoadingStats ? (
        <DashboardStatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:dashboard.stats.totalApplications')}</CardTitle>
                <HelpTooltip 
                  content={t('dashboard:dashboard.stats.totalApplicationsDesc')}
                  side="top"
                />
              </div>
              <FileText className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalApplications}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {t('dashboard:dashboard.stats.allTimeApplications')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:dashboard.stats.pending')}</CardTitle>
                <HelpTooltip 
                  content={t('dashboard:dashboard.stats.pendingDesc')}
                  side="top"
                />
              </div>
              <Clock className="h-4 w-4 text-warning hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {t('dashboard:dashboard.stats.underReview')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:dashboard.stats.approved')}</CardTitle>
              <CheckCircle className="h-4 w-4 text-success hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {t('dashboard:dashboard.stats.successfullyFunded')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{t('dashboard:dashboard.stats.rejected')}</CardTitle>
              <XCircle className="h-4 w-4 text-destructive hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {t('dashboard:dashboard.stats.notSelected')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardTitle className="text-base sm:text-lg">{t('dashboard:dashboard.quickActions.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 sm:p-6 sm:pt-2 space-y-2">
            <Link to="/opportunities">
              <Button variant="hero" className="w-full justify-start min-h-[44px]">
                <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t('dashboard:dashboard.quickActions.startNewApplication')}</span>
                <ArrowRight className="h-4 w-4 ml-auto flex-shrink-0" />
              </Button>
            </Link>
            <Link to="/opportunities">
              <Button variant="outline" className="w-full justify-start min-h-[44px]">
                <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t('dashboard:dashboard.quickActions.browseOpportunities')}</span>
                <ArrowRight className="h-4 w-4 ml-auto flex-shrink-0" />
              </Button>
            </Link>
            <Link to="/dashboard/applications">
              <Button variant="outline" className="w-full justify-start min-h-[44px]">
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t('dashboard:dashboard.quickActions.viewAllApplications')}</span>
                <ArrowRight className="h-4 w-4 ml-auto flex-shrink-0" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardTitle className="text-base sm:text-lg">{t('dashboard:dashboard.profileCompletion.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 sm:p-6 sm:pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('dashboard:dashboard.profileCompletion.status')}</span>
                <span className="font-medium">
                  {isLoadingProfile ? "..." : `${profileCompletion}% ${t('dashboard:dashboard.profileCompletion.complete')}`}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: isLoadingProfile ? "0%" : `${profileCompletion}%` }}
                ></div>
              </div>
              <Link to="/dashboard/profile">
                <Button variant="link" className="p-0 h-auto min-h-[44px] flex items-center">
                  {profileCompletion < 100 ? t('dashboard:dashboard.profileCompletion.completeProfile') : t('dashboard:dashboard.profileCompletion.viewProfile')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t('dashboard:dashboard.recentApplications.title')}</CardTitle>
          <Link to="/dashboard/applications">
            <Button variant="ghost" size="sm" className="min-h-[44px] w-full sm:w-auto">
              {t('dashboard:dashboard.recentApplications.viewAll')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {isLoadingApplications ? (
            <ApplicationListSkeleton count={3} />
          ) : recentApplications.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {recentApplications.map((app: ApplicationWithOpportunity) => (
                <div
                  key={app.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate">{app.opportunityTitle}</h3>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-4 mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                      <span className="truncate">{app.sector}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{t('dashboard:dashboard.recentApplications.submitted')} {formatDate(app.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusBadge(
                        app.status
                      )}`}
                    >
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title={t('dashboard:dashboard.emptyState.noApplications')}
              description={t('dashboard:dashboard.emptyState.noApplicationsDesc')}
              action={{
                label: t('dashboard:dashboard.emptyState.browseOpportunities'),
                onClick: () => navigate("/opportunities"),
                variant: "outline",
              }}
              secondaryAction={{
                label: t('dashboard:dashboard.emptyState.viewGuide'),
                onClick: () => navigate("/guide"),
                variant: "outline",
              }}
              helpLink="/help"
              tips={[
                t('dashboard:dashboard.emptyState.tips.completeProfile'),
                t('dashboard:dashboard.emptyState.tips.readRequirements'),
                t('dashboard:dashboard.emptyState.tips.prepareDocuments'),
                t('dashboard:dashboard.emptyState.tips.submitBeforeDeadline'),
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
