import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { getDocumentDownloadUrl } from "@/hooks/useDocumentUpload";
import { createNotification } from "@/hooks/useNotifications";
import { useActivityLogger } from "@/hooks/useActivityLogger";
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
} from "@/components/application/shared";
import type { DocumentItem } from "@/components/application/shared";
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
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { logActivity } = useActivityLogger();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      if (application?.user_id && application?.project_id) {
        const { data: userDocs, error: userError } = await (supabase
          .from("application_documents")
          .select("*")
          .eq("user_id", application.user_id)
          .eq("project_id", application.project_id)
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

  const handleApprove = async () => {
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can approve applications. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: reviewNotes.trim() || null,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      await logActivity({
        actionType: "approve",
        entityType: "application",
        entityId: id,
        description: `Approved application for "${application.projectTitle}"`,
        metadata: {
          application_id: id,
          project_id: application.project_id,
          project_title: application.projectTitle,
          reviewer_id: user.id,
          review_notes: reviewNotes.trim() || null,
        },
      });

      await createNotification(
        application.user_id,
        "Application Approved!",
        `Congratulations! Your application for "${application.projectTitle}" has been approved.`,
        "application",
        `/dashboard/applications/${id}`,
        {
          application_id: id,
          project_id: application.project_id,
          status: "approved",
        }
      );

      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });

      toast({
        title: "Application Approved",
        description: "The application has been approved successfully.",
      });

      navigate(getBackRoute());
    } catch (error) {
      console.error("Error approving application:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can reject applications. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewNotes.trim()) {
      toast({
        title: "Review Notes Required",
        description: "Please provide review notes before rejecting an application.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: reviewNotes.trim() || null,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      await logActivity({
        actionType: "reject",
        entityType: "application",
        entityId: id,
        description: `Rejected application for "${application.projectTitle}"`,
        metadata: {
          application_id: id,
          project_id: application.project_id,
          project_title: application.projectTitle,
          reviewer_id: user.id,
          review_notes: reviewNotes.trim() || null,
        },
      });

      await createNotification(
        application.user_id,
        "Application Status Updated",
        `Your application for "${application.projectTitle}" has been reviewed. Please check your application details for more information.`,
        "application",
        `/dashboard/applications/${id}`,
        {
          application_id: id,
          project_id: application.project_id,
          status: "rejected",
        }
      );

      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });

      toast({
        title: "Application Rejected",
        description: "The application has been rejected.",
      });

      navigate(getBackRoute());
    } catch (error) {
      console.error("Error rejecting application:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!isReviewer) {
      toast({
        title: "Access Denied",
        description: "Only reviewers can request additional information. Please use a reviewer account.",
        variant: "destructive",
      });
      return;
    }

    if (!reviewNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide notes about what information is needed.",
        variant: "destructive",
      });
      return;
    }

    if (!id || !application) return;

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("applications")
        .update({
          status: "under_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["review-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });

      toast({
        title: "Information Requested",
        description: "The applicant has been notified to provide additional information.",
      });

      navigate(getBackRoute());
    } catch (error) {
      console.error("Error requesting more info:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (doc: { id: string; filePath: string; fileName: string }) => {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentDownloadUrl(doc.filePath);
      if (url) {
        window.open(url, "_blank");
        toast({
          title: "Download Started",
          description: `Downloading ${doc.fileName}...`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: `Unable to download ${doc.fileName}. The file may not exist or you may not have permission to access it.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading document:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Failed to download document. Please try again.";
      toast({
        title: "Download Error",
        description: errorMessage,
        variant: "destructive",
      });
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
    <div className="space-y-4 sm:space-y-6">
      <ApplicationHeader
        title="Review Application"
        applicationId={application.id}
        status={application.status || "pending"}
        backRoute={getBackRoute()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <ApplicantInfoCard application={application} />
          <OrganizationalBackgroundCard application={application} />
          <ProjectDetailsCard application={application} />
          <SocialLinksCard application={application} />
          <ComplianceCard application={application} />
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
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Review Actions</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Submit your review decision for this application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div>
                  <Label htmlFor="reviewNotes">Review Notes</Label>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Add your review notes, feedback, or questions here..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes are required when rejecting an application
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting || application.status === "approved"}
                    className="w-full min-h-[48px] bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting || application.status === "rejected"}
                    variant="destructive"
                    className="w-full min-h-[48px]"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    onClick={handleRequestMoreInfo}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full min-h-[48px]"
                  >
                    Request Info
                  </Button>
                </div>
              </CardContent>
            </Card>
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
