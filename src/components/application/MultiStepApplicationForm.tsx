import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useApplicationFormStore, type ApplicationFormData } from "@/stores/applicationForm";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { useAuth } from "@/hooks/useAuth";
import { createNotification } from "@/hooks/useNotifications";
// PaymentStep removed - now using Stripe Checkout redirect after submission
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { isProjectOpen } from "@/lib/projectAvailability";
import { isRateLimitError } from "@/lib/rateLimits";
// Email integration - uncomment to enable application confirmation emails
// import { sendApplicationSubmittedEmail } from "@/lib/email";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  type ApplicationFormValues,
} from "./form/schemas";
import { stepTitles } from "./form/constants";
import {
  Step1ApplicantInfo,
  Step2OrganizationalBackground,
  Step3ProjectOverview,
  Step4SocialLinks,
  Step5Documents,
  Step6Review,
  Step7Compliance,
  Step9Submit,
} from "./form/steps";


const MultiStepApplicationForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewApplication = searchParams.get("new") === "true";
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { user } = useAuth();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEmailVerified =
    user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;
  const {
    currentStep,
    totalSteps,
    formData,
    isDirty,
    nextStep,
    previousStep,
    goToStep,
    updateFormData,
    setFormData,
    canProceedToNextStep,
    isStepValid,
    reset,
    markAsSaved,
    setDraftId,
  } = useApplicationFormStore();

  // Manual save hook
  const {
    isSaving,
    lastSavedAt,
    draftId,
    saveDraft,
    loadExistingDraft,
    deleteDraft,
  } = useAutoSaveDraft({
    formData,
    onSaved: markAsSaved,
  });

  // Load existing draft on mount (unless starting a new application)
  useEffect(() => {
    const loadDraft = async () => {
      if (formData.projectId && !draftLoaded && !isNewApplication) {
        const existingData = await loadExistingDraft();
        if (existingData) {
          setFormData({ ...formData, ...existingData } as ApplicationFormData);
          toast({
            title: "Draft Restored",
            description: "Your previously saved draft has been loaded.",
          });
        }
        setDraftLoaded(true);
      } else if (isNewApplication) {
        setDraftLoaded(true);
      }
    };
    loadDraft();
  }, [
    formData.projectId,
    draftLoaded,
    isNewApplication,
    loadExistingDraft,
    setFormData,
    toast,
  ]);

  // Update draftId in store when it changes
  useEffect(() => {
    if (draftId) {
      setDraftId(draftId);
    }
  }, [draftId, setDraftId]);

  // Get selected files from store (persists across navigation)
  const { selectedFiles, selectedLibraryDocIds, setSelectedFiles, setSelectedLibraryDocIds } = useApplicationFormStore();
  const { uploadDocuments, linkLibraryDocumentToApplication } =
    useDocumentUpload();

  // Memoize the files change callback
  const handleFilesChange = useCallback((files: File[]) => {
    setSelectedFiles(files);
  }, [setSelectedFiles]);

  // Handle library document selection
  const handleLibraryDocumentsChange = useCallback((documentIds: string[]) => {
    setSelectedLibraryDocIds(documentIds);
  }, [setSelectedLibraryDocIds]);

  // Step 4 has no schema - it's just review
  const step4Schema = z.object({});

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(
      currentStep === 1
        ? step1Schema
        : currentStep === 2
        ? formData.applicantType === "Individual"
          ? z.object({})
          : step2Schema
        : currentStep === 3
        ? step3Schema
        : currentStep === 4
        ? step5Schema // Social Links
        : currentStep === 5
        ? step6Schema // Documents
        : currentStep === 6
        ? z.object({}) // Review (no schema)
        : currentStep === 7
        ? step4Schema // Compliance & Declarations
        : z.object({}) // Submit (no schema)
    ) as any,
    defaultValues: {
      applicantType: formData.applicantType || undefined,
      fullLegalName: formData.fullLegalName || "",
      organizationName: formData.organizationName || "",
      registrationIdNumber: formData.registrationIdNumber || "",
      countryOfResidence: formData.countryOfResidence || "",
      cityRegion: formData.cityRegion || "",
      emailAddress: formData.emailAddress || "",
      phoneNumber: formData.phoneNumber || "",
      yearEstablished: formData.yearEstablished || undefined,
      coreMissionPurpose: formData.coreMissionPurpose || "",
      primarySectors: formData.primarySectors || [],
      primarySectorOther: formData.primarySectorOther || "",
      numberOfTeamMembers: formData.numberOfTeamMembers || undefined,
      keyTeamMembersRoles: formData.keyTeamMembersRoles || "",
      previousGrantsFundingReceived:
        formData.previousGrantsFundingReceived || false,
      previousGrantsFundingDetails: formData.previousGrantsFundingDetails || "",
      projectTitle: formData.projectTitle || "",
      projectSummary: formData.projectSummary || "",
      geographicFocus: formData.geographicFocus || "",
      informationAccurateConfirmed:
        formData.informationAccurateConfirmed || false,
      conflictOfInterestDeclared: formData.conflictOfInterestDeclared || false,
      reportingRequirementsAgreed:
        formData.reportingRequirementsAgreed || false,
      dataProcessingConsented: formData.dataProcessingConsented || false,
      declarationDate: formData.declarationDate || undefined,
      documents: [],
    },
    mode: "onChange",
  });

  // Use a ref to track if we're resetting to prevent infinite loop
  const isResettingRef = useRef(false);

  // Update form when step changes (only reset when step changes, not when formData changes)
  useEffect(() => {
    isResettingRef.current = true;
    form.reset({
      applicantType: formData.applicantType || undefined,
      fullLegalName: formData.fullLegalName || "",
      organizationName: formData.organizationName || "",
      registrationIdNumber: formData.registrationIdNumber || "",
      countryOfResidence: formData.countryOfResidence || "",
      cityRegion: formData.cityRegion || "",
      emailAddress: formData.emailAddress || "",
      phoneNumber: formData.phoneNumber || "",
      yearEstablished: formData.yearEstablished || undefined,
      coreMissionPurpose: formData.coreMissionPurpose || "",
      primarySectors: formData.primarySectors || [],
      primarySectorOther: formData.primarySectorOther || "",
      numberOfTeamMembers: formData.numberOfTeamMembers || undefined,
      keyTeamMembersRoles: formData.keyTeamMembersRoles || "",
      previousGrantsFundingReceived:
        formData.previousGrantsFundingReceived || false,
      previousGrantsFundingDetails: formData.previousGrantsFundingDetails || "",
      projectTitle: formData.projectTitle || "",
      projectSummary: formData.projectSummary || "",
      geographicFocus: formData.geographicFocus || "",
      informationAccurateConfirmed:
        formData.informationAccurateConfirmed || false,
      conflictOfInterestDeclared: formData.conflictOfInterestDeclared || false,
      reportingRequirementsAgreed:
        formData.reportingRequirementsAgreed || false,
      dataProcessingConsented: formData.dataProcessingConsented || false,
      declarationDate: formData.declarationDate || undefined,
      documents: [],
    });
    // Reset the flag after the next frame to allow form.reset to complete
    requestAnimationFrame(() => {
      isResettingRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, form]); // Only depend on currentStep and form, not formData to avoid infinite loop

  // Watch form values and sync with store (skip updates during reset)
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Skip update if we're currently resetting the form
      if (isResettingRef.current) return;

      updateFormData({
        applicantType: value.applicantType as typeof formData.applicantType,
        fullLegalName: value.fullLegalName as string | undefined,
        organizationName: value.organizationName as string | undefined,
        registrationIdNumber: value.registrationIdNumber as string | undefined,
        countryOfResidence: value.countryOfResidence as string | undefined,
        cityRegion: value.cityRegion as string | undefined,
        emailAddress: value.emailAddress as string | undefined,
        phoneNumber: value.phoneNumber as string | undefined,
        yearEstablished: value.yearEstablished as number | undefined,
        coreMissionPurpose: value.coreMissionPurpose as string | undefined,
        primarySectors: value.primarySectors as string[] | undefined,
        primarySectorOther: value.primarySectorOther as string | undefined,
        numberOfTeamMembers: value.numberOfTeamMembers as number | undefined,
        keyTeamMembersRoles: value.keyTeamMembersRoles as string | undefined,
        previousGrantsFundingReceived: value.previousGrantsFundingReceived as
          | boolean
          | undefined,
        previousGrantsFundingDetails: value.previousGrantsFundingDetails as
          | string
          | undefined,
        projectTitle: value.projectTitle as string | undefined,
        projectSummary: value.projectSummary as string | undefined,
        geographicFocus: value.geographicFocus as string | undefined,
        informationAccurateConfirmed:
          value.informationAccurateConfirmed as boolean,
        conflictOfInterestDeclared: value.conflictOfInterestDeclared as boolean,
        reportingRequirementsAgreed:
          value.reportingRequirementsAgreed as boolean,
        dataProcessingConsented: value.dataProcessingConsented as boolean,
        declarationDate: value.declarationDate as Date | undefined,
      });
    });

    return () => subscription.unsubscribe();
  }, [form, updateFormData]);

  const handleNext = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      nextStep();
      markAsSaved();
    } else {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
    }
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleStepClick = async (step: number) => {
    if (step < currentStep) {
      goToStep(step);
    } else if (step === currentStep + 1) {
      await handleNext();
    }
  };

  const validateProjectIsOpen = async (projectId: number): Promise<boolean> => {
    const { data: project, error } = await supabase
      .from("projects")
      .select("id, title, status, deadline")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!project || !isProjectOpen(project.status, project.deadline)) {
      toast({
        title: "Applications Closed",
        description:
          "This project is closed. You can no longer submit or edit applications.",
        variant: "destructive",
      });
      navigate(projectId ? `/projects/${projectId}` : "/projects");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to submit your application.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Check if email is verified
      if (!user.email_confirmed_at) {
        toast({
          title: "Email Verification Required",
          description:
            "Please verify your email address before submitting an application. Check your inbox for the verification link.",
          variant: "destructive",
        });
        return;
      }

      if (!formData.projectId) {
        toast({
          title: "Project Required",
          description: "Please select a project to apply for.",
          variant: "destructive",
        });
        return;
      }

      const isOpen = await validateProjectIsOpen(formData.projectId);
      if (!isOpen) {
        return;
      }

      // Check if user already has a submitted (non-draft) application for this project
      const { data: existingApplication, error: checkError } = await supabase
        .from("applications")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("project_id", formData.projectId)
        .eq("is_draft", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing application:", checkError);
      }

      if (existingApplication) {
        toast({
          title: "Already Applied",
          description:
            "You already submitted an application for this opportunity. You can’t submit another one.",
          variant: "destructive",
        });
        navigate(`/dashboard/applications/${existingApplication.id}`);
        return;
      }

      // Validate required fields from formData (collected across all steps)
      if (
        !formData.applicantType ||
        !formData.fullLegalName ||
        !formData.countryOfResidence ||
        !formData.emailAddress ||
        !formData.phoneNumber ||
        !formData.projectTitle ||
        !formData.projectSummary ||
        !formData.geographicFocus
      ) {
        toast({
          title: "Missing Information",
          description: "Please complete all required fields before submitting.",
          variant: "destructive",
        });
        return;
      }

      // Validate compliance & declarations
      if (
        !formData.informationAccurateConfirmed ||
        !formData.conflictOfInterestDeclared ||
        !formData.reportingRequirementsAgreed ||
        !formData.dataProcessingConsented
      ) {
        toast({
          title: "Compliance Required",
          description:
            "Please confirm all compliance declarations before submitting.",
          variant: "destructive",
        });
        return;
      }

      // Determine if this project requires a fee
      const { data: projectInfo } = await supabase
        .from("projects")
        .select("id, title, application_fee")
        .eq("id", formData.projectId)
        .single();

      const feeValue = projectInfo?.application_fee ? Number(projectInfo.application_fee) : 0;
      const hasFee = feeValue > 0;
      const initialStatus = hasFee ? "pending_payment" : "pending";

      let application;

      // Prepare application data with all new fields
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

      // Add organizational background fields if not Individual
      if (formData.applicantType !== "Individual") {
        applicationData.year_established = formData.yearEstablished || null;
        applicationData.core_mission_purpose =
          formData.coreMissionPurpose || null;
        applicationData.primary_sectors = formData.primarySectors
          ? JSON.stringify(formData.primarySectors)
          : null;
        applicationData.primary_sector_other =
          formData.primarySectorOther || null;
        applicationData.team_size = formData.numberOfTeamMembers || null;
        applicationData.key_team_members_roles =
          formData.keyTeamMembersRoles || null;
        applicationData.previous_grants_funding_received =
          formData.previousGrantsFundingReceived || false;
        applicationData.previous_grants_funding_details =
          formData.previousGrantsFundingDetails || null;
      }

      // Check if we have an existing draft to convert to submission
      if (draftId) {
        // Update existing draft to submitted application
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
        // Insert new application
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

      // Link library documents to application if any were selected
      if (selectedLibraryDocIds.length > 0 && application) {
        try {
          toast({
            title: "Linking Documents",
            description: `Linking ${selectedLibraryDocIds.length} document${
              selectedLibraryDocIds.length > 1 ? "s" : ""
            } from library...`,
          });

          const linkPromises = selectedLibraryDocIds.map((docId) =>
            linkLibraryDocumentToApplication(
              docId,
              application.id,
              application.project_id
            )
          );

          const linkedDocs = await Promise.all(linkPromises);
          const successfulLinks = linkedDocs.filter((doc) => doc !== null);

          if (successfulLinks.length > 0) {
            toast({
              title: "Documents Linked",
              description: `Successfully linked ${
                successfulLinks.length
              } document${
                successfulLinks.length > 1 ? "s" : ""
              } from your library.`,
            });
          }
        } catch (error) {
          console.error("Error linking library documents:", error);
          toast({
            title: "Document Link Warning",
            description:
              "Some library documents failed to link. Your application was submitted successfully.",
            variant: "destructive",
          });
        }
      }

      // Upload new documents if any were selected
      if (selectedFiles.length > 0 && application) {
        try {
          toast({
            title: "Uploading Documents",
            description: `Uploading ${selectedFiles.length} document${
              selectedFiles.length > 1 ? "s" : ""
            }...`,
          });

          const uploadedDocs = await uploadDocuments(
            selectedFiles,
            application.id,
            application.project_id
          );

          if (uploadedDocs.length > 0) {
            toast({
              title: "Documents Uploaded",
              description: `Successfully uploaded ${
                uploadedDocs.length
              } document${uploadedDocs.length > 1 ? "s" : ""}.`,
            });
          }
        } catch (error) {
          console.error("Error uploading documents:", error);
          toast({
            title: "Document Upload Warning",
            description:
              "Some documents failed to upload. Your application was submitted successfully. You can upload documents later.",
            variant: "destructive",
          });
        }
      }

      // Log activity for application submission
      logActivity({
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

      // Get project title for notification
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", formData.projectId)
        .single();

      const projectTitle = project?.title || "the project";

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
      // This happens automatically after application submission
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
          // Log the error but don't fail submission - admin can assign manually
          console.warn(
            "Failed to assign reviewers automatically:",
            assignError
          );

          // Log activity for failed assignment
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
          // Log successful assignment
          await logActivity({
            actionType: "assign_reviewers",
            entityType: "application",
            entityId: application.id,
            description: `Assigned ${assignments.length} reviewer(s) to application`,
            metadata: {
              application_id: application.id,
              project_id: formData.projectId,
              reviewer_count: assignments.length,
              reviewer_ids: assignments.map((a) => a.reviewer_id),
            },
          });

          // Notify each assigned reviewer
          // NOTE: Notifications are also created automatically by database trigger,
          // but we create them here too for immediate feedback and to catch any issues
          const notificationResults = await Promise.allSettled(
            assignments.map(async (assignment) => {
              try {
                const notificationId = await createNotification(
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
                return {
                  reviewer_id: assignment.reviewer_id,
                  notificationId,
                  success: true,
                };
              } catch (notifError) {
                console.error(
                  `Failed to notify reviewer ${assignment.reviewer_id}:`,
                  notifError
                );
                return {
                  reviewer_id: assignment.reviewer_id,
                  error: notifError,
                  success: false,
                };
              }
            })
          );

          // Log notification results
          const successful = notificationResults.filter(
            (r) => r.status === "fulfilled" && r.value.success
          ).length;
          const failed = notificationResults.filter(
            (r) =>
              r.status === "rejected" ||
              (r.status === "fulfilled" && !r.value.success)
          ).length;

          if (failed > 0) {
            console.warn(
              `Failed to create ${failed} notification(s) for reviewer assignments. Notifications may still be created by database trigger.`
            );
          }

          if (successful > 0) {
            console.log(
              `Successfully created ${successful} notification(s) for reviewer assignments.`
            );
          }
        } else {
          // No reviewers available or assigned
          console.warn(
            "No reviewers were assigned to the application. This may be due to:"
          );
          console.warn("- No reviewers available for this project category");
          console.warn("- All available reviewers have conflicts");
          console.warn("- Insufficient reviewers in the system");

          await logActivity({
            actionType: "warning",
            entityType: "application",
            entityId: application.id,
            description:
              "No reviewers automatically assigned - manual assignment may be required",
            metadata: {
              application_id: application.id,
              project_id: formData.projectId,
            },
          });
        }
      } catch (assignErr) {
        // Catch any unexpected errors
        console.error(
          "Unexpected error during reviewer assignment:",
          assignErr
        );

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

        // Don't fail the submission if assignment fails - admin can assign manually
      }

      // If project has a fee, redirect to Stripe Checkout instead of dashboard
      if (hasFee && application) {
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
            // Reset form before redirect
            reset();
            form.reset();
            setDraftLoaded(false);
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
          form.reset();
          setDraftLoaded(false);
          setDraftId(null);
          navigate(`/dashboard/applications/${application.id}`);
          return;
        }
      }

      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      });

      // Reset form after successful submission
      reset();
      form.reset();
      setDraftLoaded(false);
      setDraftId(null);

      // Redirect to dashboard applications
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
          description:
            "You've submitted too many applications recently. Please wait an hour and try again.",
          variant: "destructive",
        });
        return;
      }

      // Unique constraint violation: user already has a non-draft application for this project
      // (idx_applications_unique_user_project)
      if (err?.code === "23505" || errorMessage.includes("idx_applications_unique_user_project")) {
        toast({
          title: "Already Applied",
          description:
            "You already submitted an application for this opportunity. You can view it from your dashboard.",
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
          description:
            "This project is no longer accepting applications or edits.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Submission Failed",
        description:
          "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {currentStep} of {totalSteps}
          </span>
          <div className="flex items-center gap-4">
            {/* Save Draft Button */}
            {formData.projectId && currentStep < totalSteps && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={saveDraft}
                disabled={isSaving}
                className="flex items-center gap-1.5 text-xs h-7"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
            )}
            {lastSavedAt && (
              <span className="text-xs text-muted-foreground">
                Last saved:{" "}
                {new Date(lastSavedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
        </div>
        <Progress value={progressPercentage} className="h-2" />

        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          {stepTitles.map((title, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isAccessible =
              stepNumber <= currentStep || isStepValid(stepNumber - 1);

            return (
              <button
                key={stepNumber}
                type="button"
                onClick={() => isAccessible && handleStepClick(stepNumber)}
                disabled={!isAccessible}
                className={cn(
                  "flex flex-col items-center gap-2 flex-1",
                  !isAccessible && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    isCompleted &&
                      "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium text-center hidden sm:block",
                    isCurrent && "text-primary"
                  )}
                >
                  {title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Email Verification Alert */}
          {user && !isEmailVerified && (
            <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                Email Verification Required
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Please verify your email address before submitting an
                application. Check your inbox for the verification link, or
                visit your dashboard to resend it.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {/* Step 1: Applicant Information */}
              {currentStep === 1 && (
                <Step1ApplicantInfo
                  control={form.control}
                  applicantType={form.watch("applicantType")}
                />
              )}

              {/* Step 2: Organizational Background */}
              {currentStep === 2 && (
                <Step2OrganizationalBackground
                  control={form.control}
                  watch={form.watch}
                  setValue={form.setValue}
                  formState={form.formState}
                  formData={formData}
                  updateFormData={updateFormData}
                />
              )}

              {/* Step 3: Project Overview */}
              {currentStep === 3 && (
                <Step3ProjectOverview control={form.control} />
              )}

              {/* Step 4: Social Links */}
              {currentStep === 4 && (
                <Step4SocialLinks control={form.control} />
              )}

              {/* Step 5: Documents */}
              {currentStep === 5 && (
                <Step5Documents
                  projectId={formData.projectId}
                  applicantType={formData.applicantType}
                  onFilesChange={handleFilesChange}
                  onLibraryDocumentsChange={handleLibraryDocumentsChange}
                />
              )}

              {/* Step 6: Review */}
              {currentStep === 6 && (
                <Step6Review
                  formData={formData}
                  selectedFiles={selectedFiles}
                  selectedLibraryDocIds={selectedLibraryDocIds}
                  goToStep={goToStep}
                />
              )}

              {/* Step 7: Compliance & Declarations */}
              {currentStep === 7 && (
                <Step7Compliance
                  control={form.control}
                  watch={form.watch}
                  setValue={form.setValue}
                  formState={form.formState}
                  updateFormData={updateFormData}
                />
              )}

              {/* Step 8: Submit */}
              {currentStep === 8 && <Step9Submit />}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                {currentStep === totalSteps ? (
                  <Button
                    type="button"
                    variant="hero"
                    className="flex items-center gap-2"
                    disabled={!isEmailVerified || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : !isEmailVerified ? (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        Verify Email to Submit
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceedToNextStep()}
                    className="flex items-center gap-2"
                    variant="hero"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultiStepApplicationForm;
                