import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useAutoSaveDraft } from "@/hooks/useAutoSaveDraft";
import { useAuth } from "@/hooks/useAuth";
import { useApplicationFormSync } from "@/hooks/useApplicationFormSync";
import { useApplicationValidation } from "@/hooks/useApplicationValidation";
import { useApplicationSubmission } from "@/hooks/useApplicationSubmission";
import type { ApplicationFormValues } from "./form/schemas";
import { getStepSchema } from "./form/getStepSchema";
import { getFormDefaults } from "./form/getFormDefaults";
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
  const [searchParams] = useSearchParams();
  const isNewApplication = searchParams.get("new") === "true";
  const { toast } = useToast();
  const { user } = useAuth();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const isEmailVerified =
    user?.email_confirmed_at !== null && user?.email_confirmed_at !== undefined;
  const {
    currentStep,
    totalSteps,
    formData,
    nextStep,
    previousStep,
    goToStep,
    updateFormData,
    setFormData,
    canProceedToNextStep,
    isStepValid,
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

  // Memoize the files change callback
  const handleFilesChange = useCallback((files: File[]) => {
    setSelectedFiles(files);
  }, [setSelectedFiles]);

  // Handle library document selection
  const handleLibraryDocumentsChange = useCallback((documentIds: string[]) => {
    setSelectedLibraryDocIds(documentIds);
  }, [setSelectedLibraryDocIds]);

  // Initialize form with dynamic schema based on current step
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(getStepSchema(currentStep, formData.applicantType)) as any,
    defaultValues: getFormDefaults(formData),
    mode: "onChange",
  });

  // Sync form with store
  useApplicationFormSync(form, currentStep);

  // Validation hook
  const { validateAll } = useApplicationValidation();

  // Submission hook
  const { submitApplication, isSubmitting } = useApplicationSubmission();

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

  const handleSubmit = async () => {
    if (!validateAll()) {
      return;
    }

    if (!isEmailVerified) {
      toast({
        title: "Email Verification Required",
        description: "Please verify your email address before submitting an application.",
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

    await submitApplication(draftId);
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
        <div className="flex items-start justify-between">
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
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shrink-0",
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
                