import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  DollarSign, 
  Users,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useApplicationFormStore } from "@/stores/applicationForm";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import DocumentUploadSection from "./DocumentUploadSection";
import { useActivityLogger } from "@/hooks/useActivityLogger";
// Email integration - uncomment to enable application confirmation emails
// import { sendApplicationSubmittedEmail } from "@/lib/email";

// Step 1: Company Information Schema
const step1Schema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().min(10, "Please enter a valid phone number"),
  location: z.string().min(2, "Location is required"),
});

const step2Schema = z.object({
  projectDescription: z.string().min(50, "Description must be at least 50 characters"),
  fundingAmountRequested: z.string().min(1, "Funding amount is required"),
  businessPlan: z.string().optional(),
  teamSize: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().min(1, "Team size must be at least 1").optional()
  ),
});

// Step 3: Documents Schema (optional)
const step3Schema = z.object({
  documents: z.array(z.any()).optional(),
});

// Combined schema for final validation
const applicationSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type ApplicationFormValues = z.infer<typeof applicationSchema>;

const stepTitles = [
  "Company Information",
  "Project Details",
  "Upload Documents",
];

const MultiStepApplicationForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const {
    currentStep,
    totalSteps,
    formData,
    nextStep,
    previousStep,
    goToStep,
    updateFormData,
    canProceedToNextStep,
    isStepValid,
    reset,
    markAsSaved,
  } = useApplicationFormStore();

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(
      currentStep === 1 ? step1Schema :
      currentStep === 2 ? step2Schema :
      step3Schema
    ),
    defaultValues: {
      companyName: formData.companyName || "",
      contactEmail: formData.contactEmail || "",
      contactPhone: formData.contactPhone || "",
      location: formData.location || "",
      projectDescription: formData.projectDescription || "",
      fundingAmountRequested: formData.fundingAmountRequested || "",
      businessPlan: formData.businessPlan || "",
      teamSize: formData.teamSize || undefined,
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
      companyName: formData.companyName || "",
      contactEmail: formData.contactEmail || "",
      contactPhone: formData.contactPhone || "",
      location: formData.location || "",
      projectDescription: formData.projectDescription || "",
      fundingAmountRequested: formData.fundingAmountRequested || "",
      businessPlan: formData.businessPlan || "",
      teamSize: formData.teamSize || undefined,
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
        companyName: value.companyName,
        contactEmail: value.contactEmail,
        contactPhone: value.contactPhone,
        location: value.location,
        projectDescription: value.projectDescription,
        fundingAmountRequested: value.fundingAmountRequested,
        businessPlan: value.businessPlan,
        teamSize: value.teamSize,
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


  const handleSubmit = async (data: ApplicationFormValues) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to submit your application.",
          variant: "destructive",
        });
        navigate("/auth");
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

      // Insert application into database
      const { data: application, error } = await supabase
        .from("applications")
        .insert({
          user_id: user.id,
          project_id: formData.projectId,
          company_name: data.companyName,
          contact_email: data.contactEmail,
          contact_phone: data.contactPhone || null,
          location: data.location || null,
          project_description: data.projectDescription,
          funding_amount_requested: data.fundingAmountRequested,
          business_plan: data.businessPlan || null,
          team_size: data.teamSize || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Update uploaded documents with application_id if any
      if (formData.documents && formData.documents.length > 0 && application) {
        await supabase
          .from("application_documents")
          .update({ application_id: application.id })
          .eq("user_id", user.id)
          .is("application_id", null);
      }
      
      // Log activity for application submission
      logActivity({
        actionType: "submit",
        entityType: "application",
        entityId: application.id,
        description: `Submitted application for project ID: ${formData.projectId}`,
        metadata: { 
          projectId: formData.projectId, 
          companyName: data.companyName,
          fundingAmount: data.fundingAmountRequested,
        },
      });
      
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      });
      
      // Reset form after successful submission
      reset();
      form.reset();
      
      // Redirect to dashboard applications
      navigate("/dashboard/applications");
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
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
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{Math.round(progressPercentage)}% Complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        
        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          {stepTitles.map((title, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isAccessible = stepNumber <= currentStep || isStepValid(stepNumber - 1);
            
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
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium text-center hidden sm:block",
                  isCurrent && "text-primary"
                )}>
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Step 1: Company Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Company Information</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tell us about your company.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomFormField
                      control={form.control}
                      name="companyName"
                      fieldType={FormFieldType.INPUT}
                      label="Company Name"
                      placeholder="Enter company name"
                      icon={Building2}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="contactEmail"
                      fieldType={FormFieldType.EMAIL}
                      label="Contact Email"
                      placeholder="your.email@example.com"
                      icon={Mail}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="contactPhone"
                      fieldType={FormFieldType.TEL}
                      label="Contact Phone"
                      placeholder="+1234567890"
                      icon={Phone}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="location"
                      fieldType={FormFieldType.INPUT}
                      label="Location"
                      placeholder="City, Country"
                      icon={MapPin}
                      iconPosition="left"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Project Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Project Details</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Provide details about your project and funding needs.
                    </p>
                  </div>
                  <CustomFormField
                    control={form.control}
                    name="projectDescription"
                    fieldType={FormFieldType.TEXTAREA}
                    label="Project Description"
                    placeholder="Describe your project in detail..."
                    description="Provide a detailed description of your project (minimum 50 characters)"
                    rows={6}
                    maxLength={1000}
                    required
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomFormField
                      control={form.control}
                      name="fundingAmountRequested"
                      fieldType={FormFieldType.NUMBER}
                      label="Funding Amount Requested"
                      placeholder="50000"
                      icon={DollarSign}
                      iconPosition="left"
                      min={1000}
                      max={1000000}
                      step={1000}
                      required
                    />
                    <CustomFormField
                      control={form.control}
                      name="teamSize"
                      fieldType={FormFieldType.NUMBER}
                      label="Team Size"
                      placeholder="5"
                      icon={Users}
                      iconPosition="left"
                      min={1}
                      max={100}
                      required={false}
                    />
                  </div>
                  <CustomFormField
                    control={form.control}
                    name="businessPlan"
                    fieldType={FormFieldType.TEXTAREA}
                    label="Business Plan Summary"
                    placeholder="Brief summary of your business plan..."
                    rows={4}
                    required={false}
                  />
                </div>
              )}

              {/* Step 3: Documents */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload supporting documents for your application (optional).
                    </p>
                  </div>
                  
                  <DocumentUploadSection />
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

                {currentStep < totalSteps ? (
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
                ) : (
                  <Button
                    type="submit"
                    variant="hero"
                    className="flex items-center gap-2"
                  >
                    Submit Application
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

