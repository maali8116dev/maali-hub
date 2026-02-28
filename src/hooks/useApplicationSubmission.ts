/**
 * Hook for handling application submission logic
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { isProjectOpen } from '@/lib/projectAvailability';
import { isRateLimitError } from '@/lib/rateLimits';
import { createNotification } from '@/hooks/useNotifications';

export function useApplicationSubmission() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();
  const { uploadDocuments, linkLibraryDocumentToApplication } = useDocumentUpload();
  const { formData, selectedFiles, selectedLibraryDocIds, reset, setDraftId } = useApplicationFormStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateProjectIsOpen = async (projectId: number): Promise<boolean> => {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, title, status, deadline")
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw error;

    if (!project || !isProjectOpen(project.status, project.deadline)) {
      toast({
        title: "Applications Closed",
        description: "This project is closed. You can no longer submit or edit applications.",
        variant: "destructive",
      });
      navigate(projectId ? `/projects/${projectId}` : "/projects");
      return false;
    }

    return true;
  };

  const checkExistingApplication = async (projectId: number) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("is_draft", false)
      .maybeSingle();

    if (error) {
      console.error("Error checking existing application:", error);
      return null;
    }

    return data;
  };

  const submitApplication = async (draftId?: string | null) => {
    if (!user || !formData.projectId) {
      throw new Error("User and project ID are required");
    }

    setIsSubmitting(true);

    try {
      // Validate project is still open
      const isOpen = await validateProjectIsOpen(formData.projectId);
      if (!isOpen) {
        setIsSubmitting(false);
        return;
      }

      // Check for existing application
      const existingApplication = await checkExistingApplication(formData.projectId);
      if (existingApplication) {
        toast({
          title: "Already Applied",
          description: "You already submitted an application for this opportunity. You can't submit another one.",
          variant: "destructive",
        });
        navigate(`/dashboard/applications/${existingApplication.id}`);
        setIsSubmitting(false);
        return;
      }

      // Get project info for fee
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("id, title, application_fee")
        .eq("id", formData.projectId)
        .single();

      const feeValue = projectInfo?.application_fee ? Number(projectInfo.application_fee) : 0;
      const hasFee = feeValue > 0;
      const initialStatus = hasFee ? "pending_payment" : "pending";

      // Prepare application data
      const applicationData: any = {
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
        reporting_requirements_agreed: formData.reportingRequirementsAgreed,
        data_processing_consented: formData.dataProcessingConsented,
        declaration_date: new Date().toISOString(),
        status: initialStatus,
        is_draft: false,
        application_fee_paid: false,
        stripe_payment_intent_id: null,
      };

      // Add organizational background if not Individual
      if (formData.applicantType !== "Individual") {
        applicationData.year_established = formData.yearEstablished || null;
        applicationData.core_mission_purpose = formData.coreMissionPurpose || null;
        applicationData.primary_sectors = formData.primarySectors
          ? JSON.stringify(formData.primarySectors)
          : null;
        applicationData.primary_sector_other = formData.primarySectorOther || null;
        applicationData.team_size = formData.numberOfTeamMembers || null;
        applicationData.key_team_members_roles = formData.keyTeamMembersRoles || null;
        applicationData.previous_grants_funding_received = formData.previousGrantsFundingReceived || false;
        applicationData.previous_grants_funding_details = formData.previousGrantsFundingDetails || null;
      }

      // Create or update application
      let application;
      if (draftId) {
        const { data, error } = await supabase
          .from("applications")
          .update({
            ...applicationData,
            project_id: formData.projectId,
          })
          .eq("id", draftId)
          .select()
          .single();

        if (error) throw error;
        application = data;
      } else {
        const { data, error } = await supabase
          .from("applications")
          .insert({
            user_id: user.id,
            project_id: formData.projectId,
            ...applicationData,
          })
          .select()
          .single();

        if (error) throw error;
        application = data;
      }

      // Link library documents
      if (selectedLibraryDocIds.length > 0 && application) {
        try {
          toast({
            title: "Linking Documents",
            description: `Linking ${selectedLibraryDocIds.length} document${selectedLibraryDocIds.length > 1 ? "s" : ""} from library...`,
          });

          await Promise.all(
            selectedLibraryDocIds.map((docId) =>
              linkLibraryDocumentToApplication(docId, application.id)
            )
          );
        } catch (linkError) {
          console.error("Error linking documents:", linkError);
          // Don't fail submission if document linking fails
        }
      }

      // Upload new files
      if (selectedFiles.length > 0 && application) {
        try {
          toast({
            title: "Uploading Documents",
            description: `Uploading ${selectedFiles.length} document${selectedFiles.length > 1 ? "s" : ""}...`,
          });

          await uploadDocuments(selectedFiles, application.id, formData.projectId);
        } catch (uploadError) {
          console.error("Error uploading documents:", uploadError);
          // Don't fail submission if upload fails
        }
      }

      // Get project title for notification
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", formData.projectId)
        .single();

      const projectTitle = project?.title || formData.projectTitle || "the project";

      // Log activity
      await logActivity({
        actionType: "submit",
        entityType: "application",
        entityId: application.id,
        description: `Submitted application for project ID: ${formData.projectId}`,
        metadata: {
          projectId: formData.projectId,
          applicantType: formData.applicantType,
          projectTitle: formData.projectTitle,
        },
      });

      // Create notification for the applicant
      await createNotification(
        user.id,
        "Application Submitted",
        `Your application for "${projectTitle}" has been successfully submitted and is now under review.`,
        "application",
        `/dashboard/applications/${application.id}`,
        {
          application_id: application.id,
          project_id: formData.projectId,
          status: "pending",
        }
      );

      // Assign reviewers using workload-balanced assignment system
      try {
        const NUM_REVIEWERS = 2; // Default number of reviewers per application

        const { data: assignments, error: assignError } = await supabase.rpc(
          "assign_reviewers_to_application",
          {
            p_application_id: application.id,
            p_num_reviewers: NUM_REVIEWERS,
          }
        );

        if (assignError) {
          console.warn("Failed to assign reviewers automatically:", assignError);
          await logActivity({
            actionType: "error",
            entityType: "application",
            entityId: application.id,
            description: `Failed to automatically assign reviewers: ${assignError.message}`,
            metadata: {
              application_id: application.id,
              project_id: formData.projectId,
              error: assignError.message,
            },
          });
        } else if (assignments && assignments.length > 0) {
          await logActivity({
            actionType: "assign_reviewers",
            entityType: "application",
            entityId: application.id,
            description: `Assigned ${assignments.length} reviewer(s) to application`,
            metadata: {
              application_id: application.id,
              project_id: formData.projectId,
              reviewer_count: assignments.length,
              reviewer_ids: assignments.map((a: any) => a.reviewer_id),
            },
          });

          // Notify each assigned reviewer
          await Promise.allSettled(
            assignments.map(async (assignment: any) => {
              try {
                await createNotification(
                  assignment.reviewer_id,
                  "New Application Assigned",
                  `A new application for "${projectTitle}" has been assigned to you for review.`,
                  "review_assigned",
                  `/reviewer/applications/${application.id}`,
                  {
                    application_id: application.id,
                    project_id: formData.projectId,
                    assignment_id: assignment.assignment_id,
                  }
                );
              } catch (notifError) {
                console.error(`Failed to notify reviewer ${assignment.reviewer_id}:`, notifError);
              }
            })
          );
        } else {
          await logActivity({
            actionType: "warning",
            entityType: "application",
            entityId: application.id,
            description: "No reviewers automatically assigned - manual assignment may be required",
            metadata: {
              application_id: application.id,
              project_id: formData.projectId,
            },
          });
        }
      } catch (assignErr) {
        console.error("Unexpected error during reviewer assignment:", assignErr);
        await logActivity({
          actionType: "error",
          entityType: "application",
          entityId: application.id,
          description: `Unexpected error during reviewer assignment: ${
            assignErr instanceof Error ? assignErr.message : "Unknown error"
          }`,
          metadata: {
            application_id: application.id,
            project_id: formData.projectId,
          },
        });
      }

      // Handle payment if required
      if (hasFee) {
        toast({
          title: "Redirecting to Payment",
          description: "You will be redirected to complete the application fee payment.",
        });

        try {
          const baseUrl = window.location.origin;
          const response = await supabase.functions.invoke("create-checkout-session", {
            body: {
              applicationId: application.id,
              projectId: formData.projectId,
              successUrl: `${baseUrl}/payment/success?application_id=${application.id}`,
              cancelUrl: `${baseUrl}/payment/cancel?application_id=${application.id}`,
            },
          });

          if (response.error) {
            throw new Error(response.error.message || "Failed to create checkout session");
          }

          const { url } = response.data;
          if (url) {
            reset();
            setDraftId(null);
            window.location.href = url;
            return;
          }
        } catch (checkoutError) {
          console.error("Checkout session error:", checkoutError);
          toast({
            title: "Payment Setup Failed",
            description: "Your application was saved. You can complete payment from your dashboard.",
            variant: "destructive",
          });
          reset();
          setDraftId(null);
          navigate(`/dashboard/applications/${application.id}`);
          return;
        }
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

      const err: any = error;
      const errorMessage =
        typeof err?.message === "string"
          ? err.message
          : error instanceof Error
            ? error.message
            : "";

      if (isRateLimitError(errorMessage)) {
        toast({
          title: "Too Many Submissions",
          description: "You've submitted too many applications recently. Please wait an hour and try again.",
          variant: "destructive",
        });
        return;
      }

      if (err?.code === "23505" || errorMessage.includes("idx_applications_unique_user_project")) {
        toast({
          title: "Already Applied",
          description: "You already submitted an application for this opportunity. You can view it from your dashboard.",
          variant: "destructive",
        });
        navigate("/dashboard/applications");
        return;
      }

      if (
        errorMessage.toLowerCase().includes("row-level security") ||
        errorMessage.toLowerCase().includes("permission denied")
      ) {
        toast({
          title: "Applications Closed",
          description: "This project is no longer accepting applications or edits.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
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

