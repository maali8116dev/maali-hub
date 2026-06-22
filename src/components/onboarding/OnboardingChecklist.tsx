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

  const checklistItems: ChecklistItem[] = [
    {
      id: 'email-verify',
      label: 'Verify your email address',
      description: 'Check your inbox for the verification link',
      completed: !!emailVerified,
      action: emailVerified ? undefined : {
        label: 'Resend Email',
        href: '/dashboard/settings'
      }
    },
    {
      id: 'complete-profile',
      label: 'Complete your profile',
      description: 'Add your business information to increase approval chances',
      completed: !!isProfileComplete,
      action: isProfileComplete ? undefined : {
        label: 'Complete Profile',
        href: '/dashboard/profile'
      }
    },
    {
      id: 'verify-kyc',
      label: 'Verify your identity (KYC)',
      description: kycVerified
        ? undefined
        : kycPending
          ? 'Your documents are under review'
          : kyc?.status === 'rejected'
            ? 'Update your documents and resubmit for verification'
            : 'Upload ID and a selfie so we can verify your identity',
      completed: kycVerified,
      action:
        kycVerified || kycPending
          ? undefined
          : {
              label: kyc?.status === 'rejected' ? 'Resubmit KYC' : 'Verify KYC',
              href: '/dashboard/profile',
            },
    },
    {
      id: 'browse-opportunities',
      label: 'Browse funding opportunities',
      description: 'Explore available opportunities that match your business',
      completed: hasApplications,
      action: hasApplications ? undefined : {
        label: 'Browse Opportunities',
        href: '/opportunities'
      }
    },
    ...(canApplyToOpportunities
      ? [
          {
            id: 'submit-application',
            label: 'Submit your first application',
            description: 'Apply for opportunities to get started',
            completed: hasSubmittedApplication,
            action: hasSubmittedApplication
              ? undefined
              : {
                  label: 'Start Application',
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
              <span className="text-sm font-medium">Getting Started</span>
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
            {completedCount} of {totalCount} tasks completed
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            View Full Checklist
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
            <CardTitle className="text-lg">Getting Started</CardTitle>
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
          Complete these steps to get the most out of Maali
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount} of {totalCount} completed
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
              <span>All set! You're ready to go.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}









