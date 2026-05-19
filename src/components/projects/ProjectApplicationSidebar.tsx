import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn, CheckCircle2, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isOpportunityOpen } from "@/lib/opportunityAvailability";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";
import { useMembership } from "@/hooks/useMembership";
import { MembershipRequiredBanner } from "@/components/MembershipRequiredBanner";
import { useTranslation } from "react-i18next";

interface ProjectApplicationSidebarProps {
  project: OpportunityWithTags;
  draft: { updated_at: string } | null | undefined;
  existingApplication: { id: string; status: string } | null | undefined;
  hasSubmittedApplication: boolean;
  hasApprovedApplication: boolean;
}

/**
 * Component for the application sidebar with login prompts, draft handling, and application actions
 */
export function ProjectApplicationSidebar({
  project,
  draft,
  existingApplication,
  hasSubmittedApplication,
  hasApprovedApplication,
}: ProjectApplicationSidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { canApplyToOpportunities, loading: membershipLoading } = useMembership();
  const { t } = useTranslation(["common"]);

  const isDisabled = !isOpportunityOpen(project.status, project.deadline);
  const projectId = project.id.toString();
  const needsMembership = !!user && !membershipLoading && !canApplyToOpportunities;
  const applyBlocked = isDisabled || needsMembership;

  const handleNavigateToApplication = (newApplication = false) => {
    if (needsMembership) {
      navigate("/join");
      return;
    }
    if (!user) {
      toast({
        title: t("common:projectApplicationSidebar.loginRequiredTitle"),
        description: newApplication
          ? t("common:projectApplicationSidebar.loginRequiredStartNew")
          : t("common:projectApplicationSidebar.loginRequiredContinue"),
        variant: "default",
      });
      navigate("/auth", {
        state: {
          from: {
            pathname: `/opportunities/${projectId}/apply${newApplication ? "?new=true" : ""}`,
          },
        },
      });
    } else {
      navigate(`/opportunities/${projectId}/apply${newApplication ? "?new=true" : ""}`);
    }
  };

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <CardTitle>
          {isDisabled
            ? t("common:projectApplicationSidebar.applicationsClosed")
            : t("common:projectApplicationSidebar.startYourApplication")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Login Banner */}
        {!user && !isDisabled && (
          <Alert className="mb-4 border-blue-500/50 bg-blue-500/5">
            <LogIn className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              {t("common:projectApplicationSidebar.loginRequiredTitle")}
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              {t("common:projectApplicationSidebar.loginRequiredApply")}
            </AlertDescription>
          </Alert>
        )}

        {/* Approved Application Banner */}
        {hasSubmittedApplication && (
          <Alert
            className={`mb-4 ${
              hasApprovedApplication
                ? "border-success/50 bg-success/5"
                : "border-primary/50 bg-primary/5"
            }`}
          >
            <CheckCircle2
              className={`h-4 w-4 ${
                hasApprovedApplication ? "text-success" : "text-primary"
              }`}
            />
            <AlertTitle
              className={hasApprovedApplication ? "text-success" : "text-primary"}
            >
              {hasApprovedApplication
                ? t("common:projectApplicationSidebar.applicationApproved")
                : t("common:projectApplicationSidebar.applicationSubmitted")}
            </AlertTitle>
            <AlertDescription
              className={
                hasApprovedApplication ? "text-success/80" : "text-primary/80"
              }
            >
              {t("common:projectApplicationSidebar.alreadySubmitted", {
                status: existingApplication?.status || t("common:projectApplicationSidebar.pending"),
              })}
            </AlertDescription>
          </Alert>
        )}

        {needsMembership && !isDisabled && !hasSubmittedApplication && (
          <MembershipRequiredBanner className="mb-4" />
        )}

        {hasSubmittedApplication ? (
          <Button
            className="w-full"
            variant="hero"
            size="lg"
            onClick={() =>
              navigate(`/dashboard/applications/${existingApplication!.id}`)
            }
          >
            {t("common:projectApplicationSidebar.viewYourApplication")}
          </Button>
        ) : draft ? (
          <>
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-foreground mb-1">
                {t("common:projectApplicationSidebar.savedDraftTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("common:projectApplicationSidebar.lastSaved")}{" "}
                {new Date(draft.updated_at).toLocaleDateString()}{" "}
                {t("common:projectApplicationSidebar.at")}{" "}
                {new Date(draft.updated_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Button
              className="w-full mb-2"
              variant="hero"
              size="lg"
              disabled={applyBlocked}
              onClick={() => handleNavigateToApplication(false)}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t("common:projectApplicationSidebar.continueDraft")}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              disabled={applyBlocked}
              onClick={() => handleNavigateToApplication(true)}
            >
              {t("common:projectApplicationSidebar.startNewApplication")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {isDisabled
                ? t("common:projectApplicationSidebar.noLongerAccepting")
                : t("common:projectApplicationSidebar.readyToApply")}
            </p>
            <Button
              className="w-full"
              variant="hero"
              size="lg"
              disabled={applyBlocked}
              onClick={() => handleNavigateToApplication(false)}
            >
              {isDisabled
                ? t("common:projectApplicationSidebar.applicationClosed")
                : t("common:projectApplicationSidebar.beginApplication")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}









