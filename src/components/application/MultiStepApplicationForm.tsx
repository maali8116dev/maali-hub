import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form } from "@/components/ui/form";
import CustomFormField, {
  FormFieldType,
} from "@/components/form/CustomFormField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Users,
  CheckCircle2,
  FileText,
  Edit2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  AlertTriangle,
  Info,
  Link,
} from "lucide-react";
import { useApplicationFormStore, type ApplicationFormData } from "@/stores/applicationForm";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import DocumentUploadSection from "./DocumentUploadSection";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { useAuth } from "@/hooks/useAuth";
import { emailSchema } from "@/lib/emailValidation";
import { createNotification } from "@/hooks/useNotifications";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PaymentStep } from "./PaymentStep";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import { isProjectOpen } from "@/lib/projectAvailability";
import { isRateLimitError } from "@/lib/rateLimits";
// Email integration - uncomment to enable application confirmation emails
// import { sendApplicationSubmittedEmail } from "@/lib/email";

// Helper function to count words in a string
const countWords = (text: string): number => {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Phone number validation schema
const phoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (value) => {
      if (!value) return false;
      try {
        return isValidPhoneNumber(value);
      } catch {
        return false;
      }
    },
    {
      message: "Please enter a valid international phone number",
    }
  );

// Step 1: Applicant Information Schema
const step1Schema = z.object({
  applicantType: z.enum(
    [
      "Individual",
      "Organization",
      "Startup / SME",
      "NGO / Non-profit",
      "Research / Academic",
    ],
    {
      required_error: "Please select an applicant type",
    }
  ),
  fullLegalName: z
    .string()
    .min(1, "Full legal name is required"),
  organizationName: z.string().optional(),
  registrationIdNumber: z.string().optional(),
  countryOfResidence: z.string().min(2, "Country of residence is required"),
  cityRegion: z.string().min(1, "City/region is required"),
  emailAddress: emailSchema,
  phoneNumber: phoneNumberSchema,
});

// Step 2: Organizational Background Schema (conditional - only required if not Individual)
const step2Schema = z
  .object({
    yearEstablished: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z
        .number()
        .min(1900, "Please enter a valid year")
        .max(new Date().getFullYear(), "Year cannot be in the future")
        .optional()
    ),
    coreMissionPurpose: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: "Core mission / purpose must not exceed 200 words",
      }),
    primarySectors: z.array(z.string()).optional(),
    primarySectorOther: z.string().optional(),
    numberOfTeamMembers: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().min(1, "Number of team members must be at least 1").optional()
    ),
    keyTeamMembersRoles: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: "Key team members & roles must not exceed 200 words",
      }),
    previousGrantsFundingReceived: z.boolean().default(false),
    previousGrantsFundingDetails: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 400, {
        message: "Previous grants / funding details must not exceed 400 words",
      }),
  })
  .refine(
    (data) => {
      // If previous grants received is true, details are required
      if (
        data.previousGrantsFundingReceived &&
        !data.previousGrantsFundingDetails
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Please provide details about previous grants or funding",
      path: ["previousGrantsFundingDetails"],
    }
  );

// Step 3: Project Overview Schema
const step3Schema = z.object({
  projectTitle: z
    .string()
    .min(1, "Project title is required"),
  projectSummary: z
    .string()
    .min(1, "Project summary is required")
    .refine((val) => countWords(val) >= 50, {
      message: "Project summary must be at least 50 words",
    })
    .refine((val) => countWords(val) <= 400, {
      message: "Project summary must not exceed 400 words",
    }),
  geographicFocus: z.string().min(2, "Geographic focus is required"),
});

// Step 4: Compliance & Declarations Schema
const step4Schema = z.object({
  informationAccurateConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm that the information provided is accurate",
  }),
  conflictOfInterestDeclared: z.boolean().refine((val) => val === true, {
    message: "You must declare any conflicts of interest",
  }),
  reportingRequirementsAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to reporting requirements",
  }),
  dataProcessingConsented: z.boolean().refine((val) => val === true, {
    message: "You must consent to data processing",
  }),
  declarationDate: z.date().optional(),
});

// Step 5: Social Links Schema (optional)
const step5Schema = z.object({
  linkedinUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid LinkedIn URL" }
    ),
  githubUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid GitHub URL" }
    ),
  twitterUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid Twitter/X URL" }
    ),
  websiteUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid website URL" }
    ),
  otherSocialLinks: z
    .string()
    .optional()
    .refine((val) => !val || countWords(val) <= 100, {
      message: "Other social links must not exceed 100 words",
    }),
});

// Step 6: Documents Schema (optional)
const step6Schema = z.object({
  documents: z.array(z.any()).optional(),
});

// Combined schema for final validation
// Note: step2Schema uses .refine() which returns ZodEffects, so we use type assertion for merge
const applicationSchema = step1Schema
  .merge(step2Schema as any)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema);

type ApplicationFormValues = z.infer<typeof applicationSchema>;

const stepTitles = [
  "Applicant Information",
  "Organization Details (Optional)",
  "Project Overview",
  "Social Links",
  "Upload Documents",
  "Review",
  "Compliance & Declarations",
  "Payment",
  "Submit",
];

const PRIMARY_SECTORS = [
  { value: "Health", label: "Health" },
  { value: "Education", label: "Education" },
  { value: "Technology", label: "Technology" },
  { value: "Agriculture", label: "Agriculture" },
  { value: "Environment", label: "Environment" },
  { value: "Creative", label: "Creative" },
  { value: "Other", label: "Other" },
];

const MultiStepApplicationForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewApplication = searchParams.get("new") === "true";
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const { user } = useAuth();
  const [draftLoaded, setDraftLoaded] = useState(false);
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
        : currentStep === 8
        ? z.object({}) // Payment (no schema)
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

      // Check if user already has an approved application for this project
      const { data: existingApplication, error: checkError } = await supabase
        .from("applications")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("project_id", formData.projectId)
        .eq("is_draft", false)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing application:", checkError);
      }

      if (existingApplication?.status === "approved") {
        toast({
          title: "Application Already Approved",
          description: "You already have an approved application for this project. You cannot submit another application.",
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

      // Payment validation skipped - Stripe payments not fully implemented yet
      // Payment step will show "coming soon" message and allow proceeding

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
        status: "pending",
        is_draft: false,
        application_fee_paid: formData.paymentCompleted || false,
        stripe_payment_intent_id: formData.paymentIntentId || null,
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

      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      });

      // Reset form after successful submission
      reset();
      form.reset();
      setDraftLoaded(false);
      setDraftId(null); // Clear draftId from store to prevent auto-save after submission

      // Redirect to dashboard applications
      navigate("/dashboard/applications");
    } catch (error) {
      console.error("Submission error:", error);

      const errorMessage = error instanceof Error ? error.message : "";

      if (isRateLimitError(errorMessage)) {
        toast({
          title: "Too Many Submissions",
          description:
            "You've submitted too many applications recently. Please wait an hour and try again.",
          variant: "destructive",
        });
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
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Applicant Information
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tell us about yourself or your organization.
                    </p>
                  </div>

                  <CustomFormField
                    control={form.control}
                    name="applicantType"
                    fieldType={FormFieldType.SELECT}
                    label="Applicant Type"
                    placeholder="Select applicant type"
                    required
                    options={[
                      { value: "Individual", label: "Individual" },
                      { value: "Organization", label: "Organization" },
                      { value: "Startup / SME", label: "Startup / SME" },
                      { value: "NGO / Non-profit", label: "NGO / Non-profit" },
                      {
                        value: "Research / Academic",
                        label: "Research / Academic",
                      },
                    ]}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomFormField
                      control={form.control}
                      name="fullLegalName"
                      fieldType={FormFieldType.INPUT}
                      label="Full Legal Name"
                      placeholder="Enter full legal name"
                      required
                    />
                    {form.watch("applicantType") &&
                      (form.watch("applicantType") === "Organization" ||
                        form.watch("applicantType") === "Startup / SME" ||
                        form.watch("applicantType") === "NGO / Non-profit" ||
                        form.watch("applicantType") ===
                          "Research / Academic") && (
                        <CustomFormField
                          control={form.control}
                          name="organizationName"
                          fieldType={FormFieldType.INPUT}
                          label="Organization Name"
                          placeholder="Enter organization name"
                          icon={Building2}
                          iconPosition="left"
                        />
                      )}
                    <CustomFormField
                      control={form.control}
                      name="registrationIdNumber"
                      fieldType={FormFieldType.INPUT}
                      label="Official ID / Registration Number"
                      placeholder="Enter government ID or registration number"
                    />
                    <CustomFormField
                      control={form.control}
                      name="countryOfResidence"
                      fieldType={FormFieldType.INPUT}
                      label="Country of Residence / Registration"
                      placeholder="Enter country"
                      icon={MapPin}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="cityRegion"
                      fieldType={FormFieldType.INPUT}
                      label="City / Region"
                      placeholder="Enter city or region"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="emailAddress"
                      fieldType={FormFieldType.EMAIL}
                      label="Email Address"
                      placeholder="your.email@example.com"
                      icon={Mail}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="phoneNumber"
                      fieldType={FormFieldType.PHONE_INTERNATIONAL}
                      label="Phone Number"
                      placeholder="Enter phone number"
                      icon={Phone}
                      iconPosition="left"
                      defaultCountry="US"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Organizational Background */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {formData.applicantType === "Individual" ? (
                    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        These organization details are optional and usually not
                        needed for individual applicants. You can proceed to the
                        next step.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Organization Details (Optional)
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Share additional context about your organization's
                          credibility and capacity. You can also provide this
                          information in supporting documents.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CustomFormField
                          control={form.control}
                          name="yearEstablished"
                          fieldType={FormFieldType.NUMBER}
                          label="Year Established"
                          placeholder="2020"
                          min={1900}
                          max={new Date().getFullYear()}
                        />
                        <CustomFormField
                          control={form.control}
                          name="numberOfTeamMembers"
                          fieldType={FormFieldType.NUMBER}
                          label="Number of Team Members"
                          placeholder="10"
                          icon={Users}
                          iconPosition="left"
                          min={1}
                        />
                      </div>

                      <CustomFormField
                        control={form.control}
                        name="coreMissionPurpose"
                        fieldType={FormFieldType.TEXTAREA}
                        label="Core Mission / Purpose"
                        placeholder="Briefly describe your organization's core mission and purpose..."
                        description="Maximum 200 words"
                        rows={4}
                        maxLength={1200}
                      />

                      {/* Primary Sectors - Checkbox Group */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Primary Sector(s)
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {PRIMARY_SECTORS.map((sector) => (
                            <div
                              key={sector.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`sector-${sector.value}`}
                                checked={
                                  form
                                    .watch("primarySectors")
                                    ?.includes(sector.value) || false
                                }
                                onCheckedChange={(checked) => {
                                  const current =
                                    form.watch("primarySectors") || [];
                                  const updated = checked
                                    ? [...current, sector.value]
                                    : current.filter((s) => s !== sector.value);
                                  form.setValue("primarySectors", updated);
                                  updateFormData({ primarySectors: updated });
                                }}
                              />
                              <label
                                htmlFor={`sector-${sector.value}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {sector.label}
                              </label>
                            </div>
                          ))}
                        </div>
                        {form.watch("primarySectors")?.includes("Other") && (
                          <CustomFormField
                            control={form.control}
                            name="primarySectorOther"
                            fieldType={FormFieldType.INPUT}
                            label="Other Sector (Please specify)"
                            placeholder="Enter other sector"
                            className="mt-2"
                          />
                        )}
                        {form.formState.errors.primarySectors && (
                          <p className="text-sm text-destructive mt-1">
                            {String(
                              form.formState.errors.primarySectors.message
                            )}
                          </p>
                        )}
                      </div>

                      <CustomFormField
                        control={form.control}
                        name="keyTeamMembersRoles"
                        fieldType={FormFieldType.TEXTAREA}
                        label="Key Team Members & Roles"
                        placeholder="List key team members and their roles..."
                        description="Maximum 200 words"
                        rows={4}
                        maxLength={1200}
                      />

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="previousGrants"
                            checked={
                              form.watch("previousGrantsFundingReceived") ||
                              false
                            }
                            onCheckedChange={(checked) => {
                              form.setValue(
                                "previousGrantsFundingReceived",
                                checked as boolean
                              );
                              updateFormData({
                                previousGrantsFundingReceived:
                                  checked as boolean,
                              });
                            }}
                          />
                          <label
                            htmlFor="previousGrants"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Previous grants or funding received
                          </label>
                        </div>
                        {form.watch("previousGrantsFundingReceived") && (
                          <CustomFormField
                            control={form.control}
                            name="previousGrantsFundingDetails"
                            fieldType={FormFieldType.TEXTAREA}
                            label="Previous Grants / Funding Details"
                            placeholder="Provide details about previous grants or funding received..."
                            description="Maximum 400 words"
                            rows={4}
                        maxLength={2400}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Project Overview */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Project Overview
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tell us what you want funding for.
                    </p>
                  </div>

                  <CustomFormField
                    control={form.control}
                    name="projectTitle"
                    fieldType={FormFieldType.INPUT}
                    label="Project Title"
                    placeholder="Enter project title"
                    required
                  />

                  <CustomFormField
                    control={form.control}
                    name="projectSummary"
                    fieldType={FormFieldType.TEXTAREA}
                    label="Project Summary"
                    placeholder="Provide a summary of your project (minimum 30 words)..."
                    description="Project summary must be between 30 and 400 words"
                    rows={6}
                    maxLength={2400}
                    required
                  />

                  <CustomFormField
                    control={form.control}
                    name="geographicFocus"
                    fieldType={FormFieldType.INPUT}
                    label="Geographic Focus"
                    placeholder="Where will the project run?"
                    icon={MapPin}
                    iconPosition="left"
                    required
                  />
                </div>
              )}

              {/* Step 4: Social Links */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Social Links</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Share your professional and social media profiles
                      (optional). This helps us learn more about you and your
                      work.
                    </p>
                  </div>

                  <CustomFormField
                    control={form.control}
                    name="linkedinUrl"
                    fieldType={FormFieldType.INPUT}
                    label="LinkedIn Profile URL"
                    placeholder="https://linkedin.com/in/yourprofile"
                    icon={Link}
                    iconPosition="left"
                  />

                  <CustomFormField
                    control={form.control}
                    name="githubUrl"
                    fieldType={FormFieldType.INPUT}
                    label="GitHub Profile URL"
                    placeholder="https://github.com/yourusername"
                    icon={Link}
                    iconPosition="left"
                  />

                  <CustomFormField
                    control={form.control}
                    name="twitterUrl"
                    fieldType={FormFieldType.INPUT}
                    label="Twitter/X Profile URL"
                    placeholder="https://twitter.com/yourusername"
                    icon={Link}
                    iconPosition="left"
                  />

                  <CustomFormField
                    control={form.control}
                    name="websiteUrl"
                    fieldType={FormFieldType.INPUT}
                    label="Website URL"
                    placeholder="https://yourwebsite.com"
                    icon={Link}
                    iconPosition="left"
                  />

                  <CustomFormField
                    control={form.control}
                    name="otherSocialLinks"
                    fieldType={FormFieldType.TEXTAREA}
                    label="Other Social Links"
                    placeholder="List any other relevant social media profiles or links (e.g., Instagram, Facebook, portfolio, etc.)"
                    description="Maximum 100 words"
                    rows={3}
                    maxLength={600}
                  />
                </div>
              )}

              {/* Step 5: Documents */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Upload Documents
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload supporting documents for your application
                      (optional).
                    </p>
                  </div>

                  <DocumentUploadSection
                    projectId={formData.projectId}
                    onFilesChange={handleFilesChange}
                    onLibraryDocumentsChange={handleLibraryDocumentsChange}
                    applicantType={formData.applicantType}
                  />
                </div>
              )}

              {/* Step 6: Review */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Review Your Application
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please review all the information below before proceeding.
                    </p>
                  </div>

                  {/* Applicant Information Review */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Applicant Information
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToStep(1)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Applicant Type:
                        </span>
                        <p className="font-medium">
                          {formData.applicantType || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Full Legal Name:
                        </span>
                        <p className="font-medium">
                          {formData.fullLegalName || "Not provided"}
                        </p>
                      </div>
                      {formData.organizationName && (
                        <div>
                          <span className="text-muted-foreground">
                            Organization Name:
                          </span>
                          <p className="font-medium">
                            {formData.organizationName}
                          </p>
                        </div>
                      )}
                      {formData.registrationIdNumber && (
                        <div>
                          <span className="text-muted-foreground">
                            Registration / ID Number:
                          </span>
                          <p className="font-medium">
                            {formData.registrationIdNumber}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">
                          Country of Residence:
                        </span>
                        <p className="font-medium">
                          {formData.countryOfResidence || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          City / Region:
                        </span>
                        <p className="font-medium">
                          {formData.cityRegion || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Email Address:
                        </span>
                        <p className="font-medium">
                          {formData.emailAddress || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Phone Number:
                        </span>
                        <p className="font-medium">
                          {formData.phoneNumber || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Organizational Background Review */}
                  {formData.applicantType &&
                    formData.applicantType !== "Individual" && (
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            Organizational Background
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => goToStep(2)}
                            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {formData.yearEstablished && (
                            <div>
                              <span className="text-muted-foreground">
                                Year Established:
                              </span>
                              <p className="font-medium">
                                {formData.yearEstablished}
                              </p>
                            </div>
                          )}
                          {formData.numberOfTeamMembers && (
                            <div>
                              <span className="text-muted-foreground">
                                Number of Team Members:
                              </span>
                              <p className="font-medium">
                                {formData.numberOfTeamMembers}
                              </p>
                            </div>
                          )}
                          {formData.coreMissionPurpose && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">
                                Core Mission / Purpose:
                              </span>
                              <p className="font-medium mt-1 whitespace-pre-wrap">
                                {formData.coreMissionPurpose}
                              </p>
                            </div>
                          )}
                          {formData.primarySectors &&
                            formData.primarySectors.length > 0 && (
                              <div className="md:col-span-2">
                                <span className="text-muted-foreground">
                                  Primary Sector(s):
                                </span>
                                <p className="font-medium mt-1">
                                  {formData.primarySectors.join(", ")}
                                  {formData.primarySectorOther &&
                                    ` (${formData.primarySectorOther})`}
                                </p>
                              </div>
                            )}
                          {formData.keyTeamMembersRoles && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">
                                Key Team Members & Roles:
                              </span>
                              <p className="font-medium mt-1 whitespace-pre-wrap">
                                {formData.keyTeamMembersRoles}
                              </p>
                            </div>
                          )}
                          {formData.previousGrantsFundingReceived && (
                            <div className="md:col-span-2">
                              <span className="text-muted-foreground">
                                Previous Grants / Funding:
                              </span>
                              <p className="font-medium mt-1 whitespace-pre-wrap">
                                {formData.previousGrantsFundingDetails || "Yes"}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Project Overview Review */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Project Overview
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToStep(3)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Project Title:
                        </span>
                        <p className="font-medium">
                          {formData.projectTitle || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Project Summary:
                        </span>
                        <p className="font-medium mt-1 whitespace-pre-wrap">
                          {formData.projectSummary || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Geographic Focus:
                        </span>
                        <p className="font-medium">
                          {formData.geographicFocus || "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Social Links Review */}
                  {(formData.linkedinUrl ||
                    formData.githubUrl ||
                    formData.twitterUrl ||
                    formData.websiteUrl ||
                    formData.otherSocialLinks) && (
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Mail className="h-4 w-4 text-primary" />
                          Social Links
                        </h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => goToStep(4)}
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {formData.linkedinUrl && (
                          <div>
                            <span className="text-muted-foreground">
                              LinkedIn:
                            </span>
                            <p className="font-medium break-all">
                              <a
                                href={formData.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {formData.linkedinUrl}
                              </a>
                            </p>
                          </div>
                        )}
                        {formData.githubUrl && (
                          <div>
                            <span className="text-muted-foreground">
                              GitHub:
                            </span>
                            <p className="font-medium break-all">
                              <a
                                href={formData.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {formData.githubUrl}
                              </a>
                            </p>
                          </div>
                        )}
                        {formData.twitterUrl && (
                          <div>
                            <span className="text-muted-foreground">
                              Twitter/X:
                            </span>
                            <p className="font-medium break-all">
                              <a
                                href={formData.twitterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {formData.twitterUrl}
                              </a>
                            </p>
                          </div>
                        )}
                        {formData.websiteUrl && (
                          <div>
                            <span className="text-muted-foreground">
                              Website:
                            </span>
                            <p className="font-medium break-all">
                              <a
                                href={formData.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {formData.websiteUrl}
                              </a>
                            </p>
                          </div>
                        )}
                        {formData.otherSocialLinks && (
                          <div className="md:col-span-2">
                            <span className="text-muted-foreground">
                              Other Social Links:
                            </span>
                            <p className="font-medium mt-1 whitespace-pre-wrap">
                              {formData.otherSocialLinks}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Documents Review */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Documents
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToStep(5)}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      {selectedLibraryDocIds.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">
                            From Library:{" "}
                          </span>
                          <span className="font-medium">
                            {selectedLibraryDocIds.length} document(s)
                          </span>
                        </div>
                      )}
                      {selectedFiles.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">
                            New Uploads:{" "}
                          </span>
                          <span className="font-medium">
                            {selectedFiles.length} document(s)
                          </span>
                        </div>
                      )}
                      {selectedLibraryDocIds.length === 0 &&
                        selectedFiles.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            No documents selected
                          </p>
                        )}
                      {(selectedLibraryDocIds.length > 0 ||
                        selectedFiles.length > 0) && (
                        <p className="text-xs text-muted-foreground italic mt-2">
                          Documents will be linked/uploaded when you submit your
                          application
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: Compliance & Declarations */}
              {currentStep === 7 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Compliance & Declarations
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please read and confirm the following declarations. All
                      fields are required for governance purposes.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="informationAccurate"
                          checked={!!form.watch("informationAccurateConfirmed")}
                          onCheckedChange={(checked) => {
                            form.setValue(
                              "informationAccurateConfirmed",
                              !!checked
                            );
                            updateFormData({
                              informationAccurateConfirmed: !!checked,
                            });
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="informationAccurate"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Confirmation that information is accurate
                          </label>
                          <p className="text-sm text-muted-foreground mt-1">
                            I confirm that all information provided in this
                            application is accurate, complete, and truthful to
                            the best of my knowledge.
                          </p>
                        </div>
                      </div>
                      {form.formState.errors.informationAccurateConfirmed && (
                        <p className="text-sm text-destructive ml-7">
                          {String(
                            form.formState.errors.informationAccurateConfirmed
                              .message
                          )}
                        </p>
                      )}
                    </div>

                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="conflictOfInterest"
                          checked={!!form.watch("conflictOfInterestDeclared")}
                          onCheckedChange={(checked) => {
                            form.setValue(
                              "conflictOfInterestDeclared",
                              !!checked
                            );
                            updateFormData({
                              conflictOfInterestDeclared: !!checked,
                            });
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="conflictOfInterest"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Conflict of interest declaration
                          </label>
                          <p className="text-sm text-muted-foreground mt-1">
                            I declare that I have disclosed any potential
                            conflicts of interest that may affect this
                            application or its evaluation.
                          </p>
                        </div>
                      </div>
                      {form.formState.errors.conflictOfInterestDeclared && (
                        <p className="text-sm text-destructive ml-7">
                          {String(
                            form.formState.errors.conflictOfInterestDeclared
                              .message
                          )}
                        </p>
                      )}
                    </div>

                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="reportingRequirements"
                          checked={!!form.watch("reportingRequirementsAgreed")}
                          onCheckedChange={(checked) => {
                            form.setValue(
                              "reportingRequirementsAgreed",
                              !!checked
                            );
                            updateFormData({
                              reportingRequirementsAgreed: !!checked,
                            });
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="reportingRequirements"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Agreement to reporting requirements
                          </label>
                          <p className="text-sm text-muted-foreground mt-1">
                            I agree to provide regular progress reports,
                            financial statements, and other documentation as
                            required by the funding organization.
                          </p>
                        </div>
                      </div>
                      {form.formState.errors.reportingRequirementsAgreed && (
                        <p className="text-sm text-destructive ml-7">
                          {String(
                            form.formState.errors.reportingRequirementsAgreed
                              .message
                          )}
                        </p>
                      )}
                    </div>

                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="dataProcessing"
                          checked={!!form.watch("dataProcessingConsented")}
                          onCheckedChange={(checked) => {
                            form.setValue("dataProcessingConsented", !!checked);
                            updateFormData({
                              dataProcessingConsented: !!checked,
                            });
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <label
                            htmlFor="dataProcessing"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Consent to data processing
                          </label>
                          <p className="text-sm text-muted-foreground mt-1">
                            I consent to the processing of my personal data and
                            application information for the purposes of
                            evaluation, administration, and communication
                            related to this application.
                          </p>
                        </div>
                      </div>
                      {form.formState.errors.dataProcessingConsented && (
                        <p className="text-sm text-destructive ml-7">
                          {String(
                            form.formState.errors.dataProcessingConsented
                              .message
                          )}
                        </p>
                      )}
                    </div>

                    <div className="bg-muted/50 border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        <strong>Declaration Date:</strong>{" "}
                        {new Date().toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: Payment */}
              {currentStep === 8 && formData.projectId && (
                <PaymentStep
                  projectId={formData.projectId}
                  applicationId={draftId}
                  onPaymentSuccess={() => {
                    updateFormData({ paymentCompleted: true });
                  }}
                />
              )}

              {/* Step 8: Submit */}
              {currentStep === 9 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Submit Your Application
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Review the confirmation notice below and click the submit
                      button to finalize your application.
                    </p>
                  </div>

                  {/* Confirmation Notice */}
                  <div className="bg-muted/50 border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      By submitting this application, you confirm that all the
                      information provided is accurate and complete. Your
                      application will be reviewed by our team and you will be
                      notified of the outcome via email.
                    </p>
                  </div>
                </div>
              )}

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
                    disabled={!isEmailVerified}
                    onClick={handleSubmit}
                  >
                    {!isEmailVerified ? (
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
