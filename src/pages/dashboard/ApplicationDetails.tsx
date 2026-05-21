import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
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
  DocumentsCard,
  ApplicationMetadataCard,
  AdminReviewSidebar,
} from "@/components/application/shared";
import type { DocumentItem } from "@/components/application/shared";
import { MemberFeatureGate } from "@/components/MemberFeatureGate";

const ApplicationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile } = useProfile();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      if (application?.user_id && application?.opportunity_id) {
        const { data: userDocs, error: userError } = await supabase
          .from("application_documents")
          .select("*")
          .eq("user_id", application.user_id)
          .eq("opportunity_id", application.opportunity_id)
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

  if (isLoading) {
    return <ApplicationDetailsSkeleton />;
  }

  if (error || !application) {
    return <ApplicationNotFound backRoute={getBackRoute()} error={error instanceof Error ? error : null} />;
  }

  return (
    <MemberFeatureGate>
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
              applicationId={application.id}
            />
          )}

          <ApplicationMetadataCard application={application} />

          {/* Actions */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              <Button
                variant="outline"
                onClick={() => navigate(getBackRoute())}
                className="w-full min-h-[44px]"
              >
                Back to Applications
              </Button>
              {application.status === "draft" && (
                isProjectOpen(application.project?.status, application.project?.deadline) ? (
                  <Link to={`/opportunities/${application.opportunity_id}/apply`} className="w-full block">
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
    </MemberFeatureGate>
  );
};

export default ApplicationDetails;








