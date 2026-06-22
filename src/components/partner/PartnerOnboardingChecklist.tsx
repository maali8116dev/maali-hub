import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { usePartnerStats } from "@/hooks/usePartnerStats";
import { usePartnerOpportunities } from "@/hooks/usePartnerOpportunities";
import { usePartnerOrgLinked } from "@/hooks/usePartnerOrg";
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
  const { t } = useTranslation("dashboard");
  const { data: org, isLoading: isLoadingOrg } = usePartnerOrg();
  const { data: stats, isLoading: isLoadingStats } = usePartnerStats();
  const { data: opportunities = [] } = usePartnerOpportunities();
  const { isLinked } = usePartnerOrgLinked();
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
  const firstOpportunityId = opportunities[0]?.id;

  const items: ChecklistItem[] = [
    {
      id: "org-profile",
      label: t("partner.checklist.items.orgProfile.label"),
      description: t("partner.checklist.items.orgProfile.description"),
      completed: hasDescription,
      action: hasDescription
        ? undefined
        : { label: t("partner.checklist.actions.editProfile"), href: "/partner/settings" },
    },
    {
      id: "org-logo",
      label: t("partner.checklist.items.orgLogo.label"),
      description: t("partner.checklist.items.orgLogo.description"),
      completed: hasLogo,
      action: hasLogo
        ? undefined
        : { label: t("partner.checklist.actions.uploadLogo"), href: "/partner/settings" },
    },
    {
      id: "first-opportunity",
      label: t("partner.checklist.items.firstOpportunity.label"),
      description: t("partner.checklist.items.firstOpportunity.description"),
      completed: hasOpportunity,
      action:
        hasOpportunity || !isLinked
          ? undefined
          : {
              label: t("partner.checklist.actions.createOpportunity"),
              href: "/partner/opportunities/new",
            },
    },
    {
      id: "first-application",
      label: t("partner.checklist.items.firstApplication.label"),
      description: t("partner.checklist.items.firstApplication.description"),
      completed: hasApplication,
      action:
        hasApplication || !firstOpportunityId
          ? undefined
          : {
              label: t("partner.checklist.actions.viewSubmissions"),
              href: `/partner/opportunities/${firstOpportunityId}/applications`,
            },
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
            <CardTitle className="text-lg">{t("partner.checklist.title")}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>{t("partner.checklist.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("partner.checklist.progress")}</span>
            <span className="font-medium">
              {t("partner.checklist.progressCount", { completed: completedCount, total: totalCount })}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                item.completed ? "bg-muted/50 border-muted" : "bg-background border-border",
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
                    item.completed && "text-muted-foreground line-through",
                  )}
                >
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
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
      </CardContent>
    </Card>
  );
}
