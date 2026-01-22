import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, XCircle, TrendingUp, Plus, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStatsSkeleton, ApplicationListSkeleton } from "@/components/ui/skeletons";
import { useApplications, ApplicationWithProject } from "@/hooks/useApplications";
import { useProfile } from "@/hooks/useProfile";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { ProfileSetupWizard } from "@/components/ProfileSetupWizard";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { data: applications, isLoading: isLoadingApplications } = useApplications();
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

  // Calculate stats from real applications
  const stats = useMemo(() => {
    if (!applications) {
      return { totalApplications: 0, pending: 0, approved: 0, rejected: 0 };
    }
    return {
      totalApplications: applications.length,
      pending: applications.filter((app) => app.status === "pending").length,
      approved: applications.filter((app) => app.status === "approved").length,
      rejected: applications.filter((app) => app.status === "rejected").length,
    };
  }, [applications]);

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
    const styles = {
      pending: "bg-warning/10 text-warning border-warning/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-muted",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isLoadingStats = isLoadingApplications;

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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Here's an overview of your activity.
        </p>
      </div>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <DashboardStatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApplications}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time applications
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Under review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully funded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Not selected
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/projects">
              <Button variant="hero" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Start New Application
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/projects">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Browse Opportunities
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/dashboard/applications">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                View All Applications
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profile Status</span>
                <span className="font-medium">
                  {isLoadingProfile ? "..." : `${profileCompletion}% Complete`}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: isLoadingProfile ? "0%" : `${profileCompletion}%` }}
                ></div>
              </div>
              <Link to="/dashboard/profile">
                <Button variant="link" className="p-0 h-auto">
                  {profileCompletion < 100 ? "Complete your profile →" : "View your profile →"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <Link to="/dashboard/applications">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoadingApplications ? (
            <ApplicationListSkeleton count={3} />
          ) : recentApplications.length > 0 ? (
            <div className="space-y-4">
              {recentApplications.map((app: ApplicationWithProject) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{app.projectTitle}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{app.sector}</span>
                      <span>•</span>
                      <span>Submitted {formatDate(app.submittedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(
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
              title="No applications yet"
              description="Start applying to funding opportunities to see your applications here."
              action={{
                label: "Browse Opportunities",
                onClick: () => navigate("/projects"),
                variant: "outline",
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
