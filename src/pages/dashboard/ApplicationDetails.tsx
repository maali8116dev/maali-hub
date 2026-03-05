import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDocumentDownloadUrl } from "@/hooks/useDocumentUpload";
import { isProjectOpen } from "@/lib/projectAvailability";
import { Loader2 } from "lucide-react";
import {
  useApplicationAssignments,
  useApplicationReviewScores,
  useReviewAggregation,
} from "@/hooks/useReviewerAssignment";
import {
  ApplicationHeader,
  ApplicationDetailsSkeleton,
  ApplicationNotFound,
  ApplicantInfoCard,
  OrganizationalBackgroundCard,
  ProjectDetailsCard,
  SocialLinksCard,
  ComplianceCard,
  DocumentsCard,
  ApplicationMetadataCard,
  AdminReviewSidebar,
} from "@/components/application/shared";
import type { DocumentItem } from "@/components/application/shared";

const ApplicationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  const isAdmin = profile?.role === "admin";

  // Determine the back route based on user role or location state
  const getBackRoute = () => {
    if (location.state?.fromAdmin || isAdmin) {
      return "/admin/applications";
    }
    return "/dashboard/applications";
  };

  // Fetch application data
  const { data: application, isLoading, error } = useQuery({
    queryKey: ["application", id],
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
        .from("projects")
        .select("*")
        .eq("id", app.project_id)
        .maybeSingle();

      const { data: applicantProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", app.user_id)
        .maybeSingle();

      const applicantName = applicantProfile
        ? `${applicantProfile.first_name || ""} ${applicantProfile.last_name || ""}`.trim() || "Unknown Applicant"
        : "Unknown Applicant";

      return {
        ...app,
        projectTitle: project?.title || "Unknown Project",
        project,
        applicantName,
        applicantEmail: app.contact_email,
        submittedAt: app.created_at,
      };
    },
    enabled: !!id,
  });

  // Fetch review data (admin only)
  const { data: assignments = [], isLoading: assignmentsLoading } = useApplicationAssignments(id || "");
  const { data: reviewScores = [], isLoading: scoresLoading } = useApplicationReviewScores(id || "");
  const { data: reviewAggregation, isLoading: aggregationLoading } = useReviewAggregation(id || "", assignments.length);

  // Fetch documents for this application
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["application-documents", id, application?.user_id],
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
      if (application?.user_id && application?.project_id) {
        const { data: userDocs, error: userError } = await supabase
          .from("application_documents")
          .select("*")
          .eq("user_id", application.user_id)
          .eq("project_id", application.project_id)
          .is("application_id", null)
          .order("created_at", { ascending: false });

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

  const handleDownload = async (doc: { id: string; filePath: string; fileName: string }) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Error downloading document:", error);
    } finally {
      setDownloadingId(null);
    }
  };

  const parseEdgeErrorBody = (edgeError: unknown): Record<string, unknown> | null => {
    const rawBody = (
      edgeError as { context?: { body?: unknown } } | undefined
    )?.context?.body;
    if (!rawBody) return null;

    try {
      if (typeof rawBody === "string") return JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof rawBody === "object") return rawBody as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  };

  const handleRetryPayment = async () => {
    if (!application) return;
    setIsRetryingPayment(true);

    try {
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            applicationId: application.id,
            projectId: application.project_id,
            successUrl: `${window.location.origin}/payment/success?application_id=${application.id}`,
            cancelUrl: `${window.location.origin}/payment/cancel?application_id=${application.id}`,
          },
        },
      );

      if (checkoutError) {
        const checkoutErrorBody = parseEdgeErrorBody(checkoutError);
        const msg = (checkoutErrorBody?.error as string | undefined) ||
          checkoutError.message ||
          "Failed to create checkout session";
        throw new Error(msg);
      }

      if (!checkoutData?.url) {
        throw new Error("Checkout session response missing URL");
      }

      window.location.assign(checkoutData.url);
    } catch (error) {
      toast({
        title: "Payment Setup Failed",
        description: error instanceof Error ? error.message : "Could not start payment checkout.",
        variant: "destructive",
      });
      setIsRetryingPayment(false);
    }
  };

  if (isLoading) {
    return <ApplicationDetailsSkeleton />;
  }

  if (error || !application) {
    return <ApplicationNotFound backRoute={getBackRoute()} error={error instanceof Error ? error : null} />;
  }

  const canRetryPayment =
    application.status === "pending_payment" &&
    application.application_fee_paid === false;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ApplicationHeader
        title="Application Details"
        applicationId={application.id}
        status={application.status || "pending"}
        backRoute={getBackRoute()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <ApplicantInfoCard application={application} />
          <OrganizationalBackgroundCard application={application} />
          <ProjectDetailsCard application={application} showProjectLink />
          <SocialLinksCard application={application} />
          <ComplianceCard application={application} />
          <DocumentsCard
            documents={documents}
            isLoading={documentsLoading}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Review Information - Admin Only */}
          {isAdmin && (
            <AdminReviewSidebar
              assignments={assignments}
              reviewScores={reviewScores}
              reviewAggregation={reviewAggregation}
              assignmentsLoading={assignmentsLoading}
              scoresLoading={scoresLoading}
              aggregationLoading={aggregationLoading}
            />
          )}

          <ApplicationMetadataCard application={application} />

          {/* Actions */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              {canRetryPayment && (
                <Button
                  onClick={handleRetryPayment}
                  disabled={isRetryingPayment}
                  className="w-full min-h-[44px]"
                >
                  {isRetryingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    "Retry Payment"
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate(getBackRoute())}
                className="w-full min-h-[44px]"
              >
                Back to Applications
              </Button>
              {application.status === "draft" && (
                isProjectOpen(application.project?.status, application.project?.deadline) ? (
                  <Link to={`/projects/${application.project_id}/apply`} className="w-full block">
                    <Button className="w-full min-h-[44px]">
                      Continue Application
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full min-h-[44px]" variant="outline" disabled>
                    Application Closed
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetails;
