import { useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import MultiStepApplicationForm from "@/components/application/MultiStepApplicationForm";
import { useApplicationFormStore } from "@/stores/applicationForm";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { isProjectOpen } from "@/lib/projectAvailability";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMembership } from "@/hooks/useMembership";
import { MembershipRequiredBanner } from "@/components/MembershipRequiredBanner";

const ApplicationFormContent = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { formData, updateFormData, reset } = useApplicationFormStore();

  const projectId = id ? parseInt(id, 10) : undefined;
  const isNewApplication = searchParams.get("new") === "true";
  const { canApplyToOpportunities, loading: membershipLoading } = useMembership();

  useEffect(() => {
    if (!membershipLoading && !canApplyToOpportunities) {
      navigate("/join", { replace: true });
    }
  }, [membershipLoading, canApplyToOpportunities, navigate]);

  const { data: opportunityState, isLoading: isLoadingOpportunity } = useQuery({
    queryKey: ["opportunity-application-state", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, status, deadline")
        .eq("id", projectId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Scope the form store by project & ?new=true
  useEffect(() => {
    if (!projectId) return;

    const currentProjectId = formData.projectId;

    // Explicitly starting a new application for this project
    if (isNewApplication) {
      reset();
      updateFormData({ projectId });
      return;
    }

    // Switching between different projects
    if (currentProjectId && currentProjectId !== projectId) {
      reset();
      updateFormData({ projectId });
      return;
    }

    // First time for this project
    if (!currentProjectId) {
      updateFormData({ projectId });
    }
  }, [projectId, isNewApplication, formData.projectId, reset, updateFormData]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(id ? `/opportunities/${id}` : "/opportunities")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {id ? "Back to Project Details" : "Back to Projects"}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Application Form</CardTitle>
            <CardDescription>
              {id 
                ? "Complete the form below to apply for this funding opportunity."
                : "Complete the form below to start your application."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOpportunity ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : opportunityState && !isProjectOpen(opportunityState.status, opportunityState.deadline) ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Applications Closed</AlertTitle>
                  <AlertDescription>
                    This opportunity is closed. New applications and edits are disabled.
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/opportunities/${opportunityState.id}`)}
                >
                  Back to Opportunity
                </Button>
              </div>
            ) : !membershipLoading && !canApplyToOpportunities ? (
              <div className="space-y-4">
                <MembershipRequiredBanner />
                <Button type="button" variant="outline" onClick={() => navigate("/join")}>
                  View membership options
                </Button>
              </div>
            ) : (
              <MultiStepApplicationForm />
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const ApplicationForm = () => {
  return (
    <ProtectedRoute>
      <ApplicationFormContent />
    </ProtectedRoute>
  );
};

export default ApplicationForm;









