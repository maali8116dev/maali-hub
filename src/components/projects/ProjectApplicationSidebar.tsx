import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn, CheckCircle2, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isOpportunityOpen } from "@/lib/opportunityAvailability";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";
import { usePlatformFee } from "@/hooks/usePlatformFee";

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
  const { data: applicationFee = 0 } = usePlatformFee();

  const isDisabled = !isOpportunityOpen(project.status, project.deadline);
  const projectId = project.id.toString();

  const handleNavigateToApplication = (newApplication = false) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: newApplication
          ? "Please log in or create an account to start a new application."
          : "Please log in or create an account to continue your application.",
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
          {isDisabled ? "Applications Closed" : "Start Your Application"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Login Banner */}
        {!user && !isDisabled && (
          <Alert className="mb-4 border-blue-500/50 bg-blue-500/5">
            <LogIn className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              Login Required
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Please log in or create an account to apply for this opportunity.
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
                ? "Application Approved"
                : "Application Submitted"}
            </AlertTitle>
            <AlertDescription
              className={
                hasApprovedApplication ? "text-success/80" : "text-primary/80"
              }
            >
              You already submitted an application for this opportunity (status:{" "}
              {existingApplication?.status || "pending"}). You can't submit another
              one.
            </AlertDescription>
          </Alert>
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
            View Your Application
          </Button>
        ) : draft ? (
          <>
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-foreground mb-1">
                You have a saved draft
              </p>
              <p className="text-xs text-muted-foreground">
                Last saved: {new Date(draft.updated_at).toLocaleDateString()} at{" "}
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
              disabled={isDisabled}
              onClick={() => handleNavigateToApplication(false)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Continue Draft
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              disabled={isDisabled}
              onClick={() => handleNavigateToApplication(true)}
            >
              Start New Application
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {isDisabled
                ? "This opportunity is no longer accepting applications."
                : "Ready to apply for this grant? Click below to begin the application process."}
            </p>
            <Button
              className="w-full"
              variant="hero"
              size="lg"
              disabled={isDisabled}
              onClick={() => handleNavigateToApplication(false)}
            >
              {isDisabled ? "Application Closed" : "Begin Application"}
            </Button>
          </>
        )}

        {applicationFee > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Application fee: ${Number(applicationFee).toFixed(2)} (processed at submission)
          </p>
        )}
      </CardContent>
    </Card>
  );
}









