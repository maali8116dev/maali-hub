/**
 * Hook for handling application submission logic
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { useApplicationFormStore } from "@/stores/applicationForm";
import { isProjectOpen } from "@/lib/projectAvailability";
import { isRateLimitError } from "@/lib/rateLimits";

type UploadedDocForCleanup = {
  id: string;
  filePath: string;
  fileName: string;
};

type SubmitApplicationResponse = {
  success?: boolean;
  error?: string;
  errorCode?: string;
  existingApplicationId?: string | null;
  applicationId?: string;
  resumedExistingApplication?: boolean;
  opportunityStatus?: string | null;
  opportunityDeadline?: string | null;
};

/**
 * Maps error codes and raw messages to user-friendly descriptions.
 * Raw errors are logged to the console for debugging.
 */
function getUserFriendlyError(errorCode?: string, _rawMessage?: string): string {
  switch (errorCode) {
    case "ALREADY_APPLIED":
      return "You've already submitted an application for this opportunity.";
    case "PROJECT_CLOSED":
      return "This opportunity is no longer accepting applications.";
    case "MEMBERSHIP_REQUIRED":
      return "Full membership is required to apply. Join MAALI as a Full Member to continue.";
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again to continue.";
    case "MISSING_PROJECT_ID":
      return "Something went wrong. Please refresh the page and try again.";
    case "VALIDATION_ERROR":
      return "We couldn't validate your application. Please try again shortly.";
    case "INVALID_BODY":
      return "Something went wrong with your form data. Please refresh and try again.";
    case "INTERNAL_ERROR":
      return "Something went wrong on our end. Please try again or contact support if the issue persists.";
    default:
      return "Something went wrong submitting your application. Please try again.";
  }
}

export function useApplicationSubmission() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { uploadDocuments } = useDocumentUpload();
  const { formData, selectedFiles, selectedLibraryDocIds, reset, setDraftId } =
    useApplicationFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseEdgeErrorBody = (edgeError: unknown): SubmitApplicationResponse | null => {
    const rawBody = (
      edgeError as { context?: { body?: unknown } } | undefined
    )?.context?.body;

    if (!rawBody) return null;

    try {
      if (typeof rawBody === "string") {
        return JSON.parse(rawBody) as SubmitApplicationResponse;
      }
      if (typeof rawBody === "object") {
        return rawBody as SubmitApplicationResponse;
      }
    } catch {
      return null;
    }

    return null;
  };

  const validateProjectIsOpen = async (opportunityId: number): Promise<boolean> => {
    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .select("id, title, status, deadline")
      .eq("id", opportunityId)
      .maybeSingle();

    if (error) throw error;

    if (!opportunity || !isProjectOpen(opportunity.status, opportunity.deadline)) {
      toast({
        title: "Applications Closed",
        description:
          "This project is closed. You can no longer submit or edit applications.",
        variant: "destructive",
      });
      navigate(opportunityId ? `/opportunities/${opportunityId}` : "/opportunities");
      return false;
    }

    return true;
  };

  const checkExistingApplication = async (opportunityId: number) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("opportunity_id", opportunityId)
      .eq("is_draft", false)
      .maybeSingle();

    if (error) {
      console.error("Error checking existing application:", error);
      return null;
    }

    return data;
  };

  async function cleanupOrphanUploads(uploads: UploadedDocForCleanup[]) {
    if (!uploads.length || !user) return;

    // IMPORTANT: We only delete docs that are still NOT linked to an application
    // and owned by the current user. This prevents deleting docs that the Edge Function
    // may have already linked, and ensures we only delete the user's own documents.
    await Promise.allSettled(
      uploads.map(async (doc) => {
        try {
          // 1) Ensure the record is still "orphaned" (application_id is null)
          //    and owned by this user
          const { data: existing, error: fetchErr } = await supabase
            .from("application_documents")
            .select("id, file_path, application_id, user_id")
            .eq("id", doc.id)
            .eq("user_id", user.id) // Security: Only fetch user's own documents
            .maybeSingle();

          if (fetchErr) {
            console.error("Cleanup fetch failed:", fetchErr);
            return;
          }

          // If it was linked already or doesn't exist, DO NOTHING.
          if (!existing) return;
          if (existing.application_id) return;

          // 2) Delete the DB record (only if still unlinked and owned by user)
          const { error: delErr } = await supabase
            .from("application_documents")
            .delete()
            .eq("id", doc.id)
            .eq("user_id", user.id) // Security: Only delete user's own documents
            .is("application_id", null);

          if (delErr) {
            console.error(`Failed deleting doc row ${doc.id}:`, delErr);
            return;
          }

          // 3) Remove from storage only if no other rows reference same file_path
          const filePath = existing.file_path ?? doc.filePath;

          const { count, error: countErr } = await supabase
            .from("application_documents")
            .select("id", { count: "exact", head: true })
            .eq("file_path", filePath);

          if (countErr) {
            console.error(`Cleanup count failed for ${filePath}:`, countErr);
            return;
          }

          if (!count || count === 0) {
            const { error: storageErr } = await supabase.storage
              .from("application-docs")
              .remove([filePath]);

            if (storageErr) {
              console.error(`Storage remove failed for ${filePath}:`, storageErr);
            }
          }
        } catch (e) {
          console.error(`Cleanup error for doc ${doc.id}:`, e);
        }
      })
    );
  }

  const submitApplication = async (
    draftId?: string | null,
    opportunityType?: string | null
  ) => {
    if (!user || !formData.projectId) {
      throw new Error("User and opportunity ID are required");
    }

    setIsSubmitting(true);

    const { data: canApply, error: membershipError } = await supabase.rpc(
      "user_can_apply_to_opportunities",
      { p_user_id: user.id },
    );
    if (membershipError) {
      console.error("Membership check failed:", membershipError);
    } else if (canApply === false) {
      toast({
        title: "Membership required",
        description: "Become a Full Member to submit applications.",
        variant: "destructive",
      });
      navigate("/join");
      setIsSubmitting(false);
      return;
    }

    // Track uploaded documents for cleanup on failure
    let uploadedDocuments: UploadedDocForCleanup[] = [];

    try {
      // Upload new files with opportunity_id set (application_id linked by edge function after creation)
      let uploadedDocumentIds: string[] = [];
      if (selectedFiles.length > 0) {
        try {
          toast({
            title: "Uploading Documents",
            description: `Uploading ${selectedFiles.length} document${
              selectedFiles.length > 1 ? "s" : ""
            }...`,
          });

          const uploadedDocs = await uploadDocuments(
            selectedFiles,
            undefined,
            formData.projectId,
            false
          );

          uploadedDocumentIds = uploadedDocs.map((doc) => doc.id);

          uploadedDocuments = uploadedDocs.map((doc) => ({
            id: doc.id,
            filePath: doc.filePath,
            fileName: doc.fileName,
          }));
        } catch (uploadError) {
          console.error("Error uploading documents:", uploadError);
          // âœ… Don't mark as destructive if you're still submitting
          toast({
            title: "Some uploads failed",
            description:
              "Some documents failed to upload. Your application will still be submitted, but without those files.",
          });
        }
      }

      const isGrantType = (opportunityType ?? "grant") === "grant";
      const applicationData = {
        applicant_type: formData.applicantType,
        full_legal_name: formData.fullLegalName,
        organization_name: formData.organizationName || null,
        registration_id_number: formData.registrationIdNumber || null,
        country_of_residence: formData.countryOfResidence,
        city_region: formData.cityRegion,
        contact_email: formData.emailAddress,
        contact_phone: formData.phoneNumber,
        project_title: formData.projectTitle,
        project_summary: formData.projectSummary,
        geographic_focus: formData.geographicFocus,
        linkedin_url: formData.linkedinUrl || null,
        github_url: formData.githubUrl || null,
        twitter_url: formData.twitterUrl || null,
        website_url: formData.websiteUrl || null,
        other_social_links: formData.otherSocialLinks || null,
        information_accurate_confirmed: formData.informationAccurateConfirmed,
        conflict_of_interest_declared: formData.conflictOfInterestDeclared,
        reporting_requirements_agreed: isGrantType
          ? formData.reportingRequirementsAgreed
          : true,
        data_processing_consented: formData.dataProcessingConsented,
        ...(formData.applicantType !== "Individual" && {
          year_established: formData.yearEstablished || null,
          core_mission_purpose: formData.coreMissionPurpose || null,
          primary_sectors: formData.primarysectors || null,
          primary_sector_other: formData.primarysectorOther || null,
          team_size: formData.numberOfTeamMembers || null,
          key_team_members_roles: formData.keyTeamMembersRoles || null,
          previous_grants_funding_received: isGrantType
            ? formData.previousGrantsFundingReceived || false
            : false,
          previous_grants_funding_details: isGrantType
            ? formData.previousGrantsFundingDetails || null
            : null,
        }),
      };

      const allDocumentIds = [...selectedLibraryDocIds, ...uploadedDocumentIds];

      // Get session token for authentication (edge function will validate)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again to continue.");
      }

      const { data, error: edgeError } = await supabase.functions.invoke(
        "submit-application",
        {
          body: {
            draftId,
            opportunityId: formData.projectId,
            applicationData,
            libraryDocumentIds: allDocumentIds,
            token: session.access_token,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const edgeErrorBody = edgeError ? parseEdgeErrorBody(edgeError) : null;
      const payload: SubmitApplicationResponse | null =
        data && typeof data === "object"
          ? (data as SubmitApplicationResponse)
          : edgeErrorBody;

      if (!payload?.success) {
        // Edge Function returned an error - application wasn't created, so cleanup uploads
        await cleanupOrphanUploads(uploadedDocuments);

        if (payload?.errorCode === "ALREADY_APPLIED") {
          toast({
            title: "Already Applied",
            description:
              "You've already submitted an application for this opportunity. Check your dashboard to view its status.",
            variant: "destructive",
          });
          navigate(
            payload.existingApplicationId
              ? `/dashboard/applications/${payload.existingApplicationId}`
              : "/dashboard/applications"
          );
          return;
        }

        if (payload?.errorCode === "PROJECT_CLOSED") {
          toast({
            title: "Applications Closed",
            description:
              "This opportunity is no longer accepting applications.",
            variant: "destructive",
          });
          navigate(`/opportunities/${formData.projectId}`);
          return;
        }

        if (payload?.errorCode === "MEMBERSHIP_REQUIRED") {
          toast({
            title: "Membership required",
            description: getUserFriendlyError("MEMBERSHIP_REQUIRED"),
            variant: "destructive",
          });
          navigate("/join");
          return;
        }

        // Log the raw error for debugging, show friendly message to user
        const rawError = payload?.error || edgeError?.message || "Unknown error";
        console.error("Submission failed:", rawError);
        if (payload?.errorCode === "OPPORTUNITY_CLOSED") {
          console.error("[Submission] OPPORTUNITY_CLOSED - status used by validation:", payload?.opportunityStatus ?? "(not returned)");
          console.error("[Submission] OPPORTUNITY_CLOSED - deadline used:", payload?.opportunityDeadline ?? "(not returned)");
        }
        if (edgeError) {
          console.error("Edge function error details:", edgeError);
        }
        if (data && typeof data === "object") {
          console.error("Edge function response:", data);
        }
        throw new Error(getUserFriendlyError(payload?.errorCode, rawError));
      }

      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      });

      reset();
      setDraftId(null);
      navigate("/dashboard/applications");
    } catch (error) {
      console.error("Submission error:", error);

      // âœ… Cleanup: delete only orphan uploads (still unlinked)
      await cleanupOrphanUploads(uploadedDocuments);

      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "";

      if (isRateLimitError(rawMessage)) {
        toast({
          title: "Too Many Submissions",
          description:
            "You've submitted too many applications recently. Please wait an hour and try again.",
          variant: "destructive",
        });
        return;
      }

      // Show the user-friendly message (the throw above already calls getUserFriendlyError)
      // For unexpected errors, show a generic message
      toast({
        title: "Submission Failed",
        description:
          rawMessage ||
          "Something went wrong submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitApplication,
    isSubmitting,
    validateProjectIsOpen,
    checkExistingApplication,
  };
}








