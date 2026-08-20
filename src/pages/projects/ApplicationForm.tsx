import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("dashboard");
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

  useEffect(() => {
    if (!projectId) return;

    const currentProjectId = formData.projectId;

    if (isNewApplication) {
      reset();
      updateFormData({ projectId });
      return;
    }

    if (currentProjectId && currentProjectId !== projectId) {
      reset();
      updateFormData({ projectId });
      return;
    }

    if (!currentProjectId) {
      updateFormData({ projectId });
    }
  }, [projectId, isNewApplication, formData.projectId, reset, updateFormData]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(id ? `/opportunities/${id}` : "/opportunities")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {id
            ? t("applications.form.page.backToProject")
            : t("applications.form.page.backToProjects")}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("applications.form.page.title")}</CardTitle>
            <CardDescription>
              {id
                ? t("applications.form.page.subtitleWithProject")
                : t("applications.form.page.subtitleGeneric")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOpportunity ? (
              <p className="text-sm text-muted-foreground">
                {t("applications.form.page.loading")}
              </p>
            ) : opportunityState && !isProjectOpen(opportunityState.status, opportunityState.deadline) ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t("applications.form.page.closedTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("applications.form.page.closedDescription")}
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/opportunities/${opportunityState.id}`)}
                >
                  {t("applications.form.page.backToOpportunity")}
                </Button>
              </div>
            ) : !membershipLoading && !canApplyToOpportunities ? (
              <div className="space-y-4">
                <MembershipRequiredBanner />
                <Button type="button" variant="outline" onClick={() => navigate("/join")}>
                  {t("applications.form.page.membershipCta")}
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
