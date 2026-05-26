import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { usePartnerStats } from "@/hooks/usePartnerStats";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  action?: { label: string; href: string };
}

interface PartnerOnboardingChecklistProps {
  onDismiss?: () => void;
}

export function PartnerOnboardingChecklist({ onDismiss }: PartnerOnboardingChecklistProps) {
  const navigate = useNavigate();
  const { data: org, isLoading: isLoadingOrg } = usePartnerOrg();
  const { data: stats, isLoading: isLoadingStats } = usePartnerStats();
  const updateOrg = useUpdatePartnerOrg();

  if (isLoadingOrg || isLoadingStats) return null;

  const handleDismiss = async () => {
    await updateOrg.mutateAsync({ onboarding_dismissed_at: new Date().toISOString() });
    onDismiss?.();
  };

  const hasDescription = !!org?.description;
  const hasLogo = !!org?.logo_url;
  const hasOpportunity = (stats?.totalOpportunities ?? 0) > 0;
  const hasApplication = (stats?.totalApplications ?? 0) > 0;

  const items: ChecklistItem[] = [
    {
      id: "org-profile",
      label: "Complete organization profile",
      description: "Add a description so applicants know who you are",
      completed: hasDescription,
      action: hasDescription ? undefined : { label: "Edit Profile", href: "/partner/settings" },
    },
    {
      id: "org-logo",
      label: "Upload organization logo",
      description: "A logo builds trust with applicants",
      completed: hasLogo,
      action: hasLogo ? undefined : { label: "Upload Logo", href: "/partner/settings" },
    },
    {
      id: "first-opportunity",
      label: "Create your first opportunity",
      description: "Start receiving applications from qualified candidates",
      completed: hasOpportunity,
      action: hasOpportunity ? undefined : { label: "Create Opportunity", href: "/partner/opportunities/new" },
    },
    {
      id: "first-application",
      label: "Review your first application",
      description: "Applications will appear once your opportunity is live",
      completed: hasApplication,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercentage = (completedCount / totalCount) * 100;
  const allCompleted = completedCount === totalCount;
  const dismissed = !!org?.onboarding_dismissed_at;

  if (dismissed || allCompleted) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Complete these steps to start receiving applications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedCount} of {totalCount} completed</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                item.completed ? "bg-muted/50 border-muted" : "bg-background border-border"
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
                <div className={cn("font-medium text-sm", item.completed && "text-muted-foreground line-through")}>
                  {item.label}
                </div>
                {item.description && <div className="text-xs text-muted-foreground mt-1">{item.description}</div>}
              </div>
              {!item.completed && item.action && (
                <Button variant="outline" size="sm" onClick={() => navigate(item.action!.href)} className="flex-shrink-0">
                  {item.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}








