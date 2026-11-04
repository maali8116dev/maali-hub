import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, X, ArrowRight, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useApplications } from '@/hooks/useApplications';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/hooks/useMembership';
import { useKycVerification } from '@/hooks/useKycVerification';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  action?: {
    label: string;
    href: string;
  };
}

interface OnboardingChecklistProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
  compact?: boolean;
}

export function OnboardingChecklist({ 
  onDismiss, 
  showDismiss = true,
  compact = false 
}: OnboardingChecklistProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { data: applications = [], isLoading: isLoadingApplications } = useApplications();
  const { canApplyToOpportunities, loading: membershipLoading } = useMembership();
  const { data: kyc, isLoading: isLoadingKyc } = useKycVerification();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedState = localStorage.getItem('onboardingChecklistDismissed');
    setDismissed(dismissedState === 'true');
  }, []);

  // Don't render until data is loaded to prevent flash/flicker
  if (isLoadingProfile || isLoadingApplications || isLoadingKyc || membershipLoading || !user) {
    return null;
  }

  const kycVerified = kyc?.status === 'verified';
  const kycPending = kyc?.status === 'pending';

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('onboardingChecklistDismissed', 'true');
    onDismiss?.();
  };

  // Check completion status
  const isProfileComplete = profile && 
    profile.firstName && 
    profile.lastName && 
    profile.country && 
    profile.businesssector;

  const hasApplications = applications.length > 0;
  const hasSubmittedApplication = applications.some(app => app.status !== 'draft');
  const emailVerified = user?.email_confirmed_at !== null;

  const kycDescription = kycVerified
    ? undefined
    : kycPending
      ? t('dashboard.onboardingChecklist.items.verifyKyc.pending')
      : kyc?.status === 'rejected'
        ? t('dashboard.onboardingChecklist.items.verifyKyc.rejected')
        : t('dashboard.onboardingChecklist.items.verifyKyc.idle');

  const checklistItems: ChecklistItem[] = [
    {
      id: 'email-verify',
      label: t('dashboard.onboardingChecklist.items.emailVerify.label'),
      description: t('dashboard.onboardingChecklist.items.emailVerify.description'),
      completed: !!emailVerified,
      action: emailVerified ? undefined : {
        label: t('dashboard.onboardingChecklist.actions.resendEmail'),
        href: '/dashboard/settings'
      }
    },
    {
      id: 'complete-profile',
      label: t('dashboard.onboardingChecklist.items.completeProfile.label'),
      description: t('dashboard.onboardingChecklist.items.completeProfile.description'),
      completed: !!isProfileComplete,
      action: isProfileComplete ? undefined : {
        label: t('dashboard.onboardingChecklist.actions.completeProfile'),
        href: '/dashboard/profile'
      }
    },
    {
      id: 'verify-kyc',
      label: t('dashboard.onboardingChecklist.items.verifyKyc.label'),
      description: kycDescription,
      completed: kycVerified,
      action:
        kycVerified || kycPending
          ? undefined
          : {
              label: kyc?.status === 'rejected'
                ? t('dashboard.onboardingChecklist.actions.resubmitKyc')
                : t('dashboard.onboardingChecklist.actions.verifyKyc'),
              href: '/dashboard/profile',
            },
    },
    {
      id: 'browse-opportunities',
      label: t('dashboard.onboardingChecklist.items.browseOpportunities.label'),
      description: t('dashboard.onboardingChecklist.items.browseOpportunities.description'),
      completed: hasApplications,
      action: hasApplications ? undefined : {
        label: t('dashboard.onboardingChecklist.actions.browseOpportunities'),
        href: '/opportunities'
      }
    },
    ...(canApplyToOpportunities
      ? [
          {
            id: 'submit-application',
            label: t('dashboard.onboardingChecklist.items.submitApplication.label'),
            description: t('dashboard.onboardingChecklist.items.submitApplication.description'),
            completed: hasSubmittedApplication,
            action: hasSubmittedApplication
              ? undefined
              : {
                  label: t('dashboard.onboardingChecklist.actions.startApplication'),
                  href: '/opportunities',
                },
          },
        ]
      : []),
  ];

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercentage = (completedCount / totalCount) * 100;
  const allCompleted = completedCount === totalCount;

  if (dismissed && !allCompleted) {
    return null;
  }

  if (allCompleted && dismissed) {
    return null;
  }

  if (compact) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('dashboard.onboardingChecklist.title')}</span>
            </div>
            {showDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Progress value={progressPercentage} className="h-2 mb-3" />
          <div className="text-xs text-muted-foreground mb-3">
            {t('dashboard.onboardingChecklist.tasksCount', { completed: completedCount, total: totalCount })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            {t('dashboard.onboardingChecklist.viewFull')}
            <ArrowRight className="h-3 w-3 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('dashboard.onboardingChecklist.title')}</CardTitle>
          </div>
          {showDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          {t('dashboard.onboardingChecklist.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('dashboard.onboardingChecklist.progress')}</span>
            <span className="font-medium">
              {t('dashboard.onboardingChecklist.progressCount', { completed: completedCount, total: totalCount })}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="space-y-3">
          {checklistItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                item.completed
                  ? "bg-muted/50 border-muted"
                  : "bg-background border-border"
              )}
            >
              <div className="mt-0.5">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-medium text-sm",
                    item.completed && "text-muted-foreground line-through"
                  )}
                >
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.description}
                  </div>
                )}
              </div>
              {!item.completed && item.action && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(item.action!.href)}
                  className="flex-shrink-0"
                >
                  {item.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {allCompleted && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('dashboard.onboardingChecklist.allSet')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}









