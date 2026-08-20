import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { getDocumentDownloadUrl } from "@/hooks/useDocumentUpload";
import { useApplicationAssignments, useApplicationReviewScores } from "@/hooks/useReviewerAssignment";
import ReviewScoringForm from "@/components/reviewer/ReviewScoringForm";
import {
  ApplicationHeader,
  ApplicationDetailsSkeleton,
  ApplicationNotFound,
  ApplicationTranslationBar,
  ApplicantInfoCard,
  OrganizationalBackgroundCard,
  ProjectDetailsCard,
  SocialLinksCard,
  DocumentsCard,
  ApplicationMetadataCard,
} from "@/components/application/shared";
import type { DocumentItem } from "@/components/application/shared";
import { useApplicationTranslation } from "@/hooks/useTranslateApplication";
// Email integration - uncomment to enable status update emails
// import { 
//   sendApplicationApprovedEmail, 
//   sendApplicationRejectedEmail,
//   sendApplicationUnderReviewEmail 
// } from "@/lib/email";

const ReviewApplication = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard", "common"]);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Determine the back route based on user role or location state
  const getBackRoute = () => {
    if (location.state?.fromAdmin) {
      return "/admin/applications";
    }
    if (profile?.role === "admin") {
      return "/admin/applications";
    }
    return "/reviewer/applications";
  };

  // Check if user is a reviewer (only reviewers can perform review actions)
  const isReviewer = profile?.role === "reviewer";
  const isAdmin = profile?.role === "admin";

  // Check if reviewer has an assignment for this application
  const { data: assignments = [], isLoading: assignmentsLoading } = useApplicationAssignments(id || "");
  const reviewerAssignment = assignments.find(a => a.reviewer_id === user?.id);

  // Check if reviewer has already submitted a review
  const { data: reviewScores = [], isLoading: reviewScoresLoading } = useApplicationReviewScores(id || "");
  const existingReview = reviewScores.find(rs => rs.reviewer_id === user?.id);

  // Fetch application data
  const { data: application, isLoading, error } = useQuery({
    queryKey: ["review-application", id],
    queryFn: async () => {
      if (!id) throw new Error("Application ID is required");

      const { data: app, error: appError } = await supabase
        .from("applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (appError) throw appError;
      if (!app) throw new Error("Application not found");

      const { data: project } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", app.opportunity_id)
        .maybeSingle();

      const { data: applicantProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", app.user_id)
        .maybeSingle();

      const profileName = applicantProfile
        ? `${applicantProfile.first_name || ""} ${applicantProfile.last_name || ""}`.trim() || null
        : null;
      const applicantName = (app.full_legal_name && app.full_legal_name.trim()) || profileName || "Unknown Applicant";

      return {
        ...app,
        projectTitle: project?.title || "Unknown Opportunity",
        project,
        applicantName,
        applicantEmail: app.contact_email,
        submittedAt: app.created_at,
      };
    },
    enabled: !!id,
  });

  // Fetch documents for this application
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["review-application-documents", id, application?.user_id],
    queryFn: async (): Promise<DocumentItem[]> => {
      if (!id) return [];

      const { data: linkedDocs, error: linkedError } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false });

      if (linkedError) {
        console.error("Error fetching linked documents:", linkedError);
      }

      let unlinkedDocs: typeof linkedDocs = [];
      if (application?.user_id && application?.opportunity_id) {
        const { data: userDocs, error: userError } = await (supabase
          .from("application_documents")
          .select("*")
          .eq("user_id", application.user_id)
          .eq("opportunity_id", application.opportunity_id)
          .is("application_id", null)
          .order("created_at", { ascending: false }) as any);

        if (!userError) {
          unlinkedDocs = userDocs || [];
        }
      }

      const allDocs = [...(linkedDocs || []), ...unlinkedDocs];
      const uniqueDocs = allDocs.filter(
        (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
      );

      return uniqueDocs.map((doc) => ({
        id: doc.id,
        fileName: doc.file_name,
        filePath: doc.file_path,
        fileSize: doc.file_size || 0,
        fileType: doc.file_type || "",
        createdAt: doc.created_at,
        applicationId: doc.application_id || undefined,
      }));
    },
    enabled: !!id && !!application,
  });

  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["review-application", id] });
    queryClient.invalidateQueries({ queryKey: ["review-scores", id] });
    queryClient.invalidateQueries({ queryKey: ["application-assignments", id] });
    queryClient.invalidateQueries({ queryKey: ["reviewer-applications"] });
    queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    
    toast({
      title: t("dashboard:reviewer.reviewApplicationPage.toasts.submitted"),
      description: t("dashboard:reviewer.reviewApplicationPage.toasts.submittedDesc"),
    });
    
    // Optionally navigate back, or stay on page to see updated status
    // navigate(getBackRoute());
  };

  const handleDownload = async (doc: { id: string; filePath: string; fileName: string }) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) {
        window.open(url, "_blank");
        toast({
          title: t("dashboard:reviewer.reviewApplicationPage.toasts.downloadStarted"),
          description: t("dashboard:reviewer.reviewApplicationPage.toasts.downloadStartedDesc", { fileName: doc.fileName }),
        });
      } else {
        toast({
          title: t("dashboard:reviewer.reviewApplicationPage.toasts.downloadFailed"),
          description: t("dashboard:reviewer.reviewApplicationPage.toasts.downloadFailedDesc", { fileName: doc.fileName }),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : t("dashboard:reviewer.reviewApplicationPage.toasts.downloadErrorDesc");
      toast({
        title: t("dashboard:reviewer.reviewApplicationPage.toasts.downloadError"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const translation = useApplicationTranslation(application, {
    enabled: (isAdmin || Boolean(reviewerAssignment)) && !!application,
    queryKeys: [["review-application", id]],
  });

  const handleTranslate = async () => {
    try {
      await translation.translate();
    } catch (error) {
      toast({
        title: translation.t("applications.detail.translation.errorTitle"),
        description: error instanceof Error ? error.message : translation.t("applications.detail.translation.errorDesc"),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <ApplicationDetailsSkeleton />;
  }

  if (error || !application) {
    return <ApplicationNotFound backRoute={getBackRoute()} error={error instanceof Error ? error : null} />;
  }

  const app = translation.displayApplication ?? application;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ApplicationHeader
        title={t("dashboard:reviewer.reviewApplicationPage.title")}
        applicationId={application.id}
        status={application.status || "pending"}
        backRoute={getBackRoute()}
      />

      <ApplicationTranslationBar
        visible={translation.canOffer}
        showTranslated={translation.showTranslated}
        hasCache={translation.hasCache}
        isTranslating={translation.isTranslating}
        sourceLocale={translation.sourceLocale}
        targetLocale={translation.targetLocale}
        onTranslate={handleTranslate}
        onShowOriginal={translation.showOriginal}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <ApplicantInfoCard application={app} />
          <OrganizationalBackgroundCard application={app} />
          <ProjectDetailsCard application={app} />
          <SocialLinksCard application={app} />
          <DocumentsCard
            documents={documents}
            isLoading={documentsLoading}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        </div>

        {/* Review Panel */}
        <div className="space-y-6">
          {isReviewer ? (
            <>
              {!reviewerAssignment ? (
                <Card className="border-warning/50 bg-warning/5">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                      {t("dashboard:reviewer.reviewApplicationPage.notAssigned.title")}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {t("dashboard:reviewer.reviewApplicationPage.notAssigned.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard:reviewer.reviewApplicationPage.notAssigned.body")}
                    </p>
                  </CardContent>
                </Card>
              ) : existingReview ? (
                <Card className="border-success/50 bg-success/5">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                      {t("dashboard:reviewer.reviewApplicationPage.submitted.title")}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {t("dashboard:reviewer.reviewApplicationPage.submitted.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("dashboard:reviewer.reviewApplicationPage.submitted.overallScore")}</span>
                        <span className="font-medium">{existingReview.overall_score?.toFixed(2) || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("dashboard:reviewer.reviewApplicationPage.submitted.recommendation")}</span>
                        <span className="font-medium capitalize">{existingReview.recommendation?.replace('_', ' ')}</span>
                      </div>
                      {existingReview.scores && Object.keys(existingReview.scores).length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium">{t("dashboard:reviewer.reviewApplicationPage.submitted.criterionScores")}</p>
                          <div className="space-y-1">
                            {Object.entries(existingReview.scores).map(([criterion, score]) => (
                              <div key={criterion} className="flex justify-between text-sm">
                                <span className="text-muted-foreground capitalize">{criterion.replace('_', ' ')}:</span>
                                <span className="font-medium">{score}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {existingReview.comments && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">{t("dashboard:reviewer.reviewApplicationPage.submitted.yourComments")}</p>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {existingReview.comments}
                          </p>
                        </div>
                      )}
                      {existingReview.submitted_at && (
                        <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                          <span>{t("dashboard:reviewer.reviewApplicationPage.submitted.submittedAt")}</span>
                          <span>{new Date(existingReview.submitted_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 bg-muted p-3 rounded-md">
                      {t("dashboard:reviewer.reviewApplicationPage.submitted.engineNote")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard:reviewer.reviewApplicationPage.submitted.updateNote")}
                    </p>
                    <ReviewScoringForm
                      applicationId={id!}
                      assignmentId={reviewerAssignment.id}
                      reviewerId={user!.id}
                      onSuccess={handleReviewSuccess}
                    />
                  </CardContent>
                </Card>
              ) : (
                <ReviewScoringForm
                  applicationId={id!}
                  assignmentId={reviewerAssignment.id}
                  reviewerId={user!.id}
                  onSuccess={handleReviewSuccess}
                />
              )}
            </>
          ) : isAdmin ? (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                  Review Actions Restricted
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Administrative accounts cannot perform review actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <p className="text-sm text-foreground mb-2">
                    <strong>Role Separation Policy:</strong>
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    To maintain proper separation of concerns and audit trails, administrative accounts can view applications but cannot approve, reject, or request changes.
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    To review this application, please use a reviewer account.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Admins manage users, projects, and system settings</p>
                  <p>• Reviewers evaluate and make decisions on applications</p>
                  <p>• This separation ensures clear accountability and audit trails</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-muted">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Access Restricted</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  You do not have permission to review applications
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <p className="text-sm text-muted-foreground">
                  Only reviewers can perform review actions on applications.
                </p>
              </CardContent>
            </Card>
          )}

          <ApplicationMetadataCard
            application={application}
            extraRows={[
              { label: "Applicant", value: application.applicantName },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default ReviewApplication;








