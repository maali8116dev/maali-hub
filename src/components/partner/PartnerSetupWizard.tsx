import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Building, Globe, Rocket, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const step1Schema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters"),
  website_url: z.string().url("Please enter a valid URL").or(z.literal("")).optional(),
});

const step2Schema = z.object({
  contactName: z.string().min(2, "Contact name is required"),
  contactPhone: z.string().optional(),
  country: z.string().optional(),
});

const step3Schema = z.object({
  opportunityTitle: z.string().optional(),
  fundingAmount: z.string().optional(),
  deadline: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;
type Step3Values = z.infer<typeof step3Schema>;

interface PartnerSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const steps = [
  { label: "Organization", icon: Building },
  { label: "Contact", icon: Globe },
  { label: "First Opportunity", icon: Rocket },
];

export function PartnerSetupWizard({ open, onOpenChange, onComplete }: PartnerSetupWizardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const { data: partnerOrg } = usePartnerOrg();
  const updateOrg = useUpdatePartnerOrg();
  const [logoUrl, setLogoUrl] = useState<string>("");

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "project-images",
    folder: `partner-logos/${user?.id || ""}`,
    maxSizeMB: 5,
  });

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      description: "",
      website_url: "",
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { contactName: "", contactPhone: "", country: "" },
  });

  const step3Form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: { opportunityTitle: "", fundingAmount: "", deadline: "" },
  });

  useEffect(() => {
    if (partnerOrg) {
      step1Form.reset({
        description: partnerOrg.description || "",
        website_url: partnerOrg.website_url || "",
      });
      setLogoUrl(partnerOrg.logo_url || "");
    }
  }, [partnerOrg, step1Form]);

  const handleNext = async () => {
    if (currentStep === 1) {
      const valid = await step1Form.trigger();
      if (valid) setCurrentStep(2);
    } else if (currentStep === 2) {
      const valid = await step2Form.trigger();
      if (valid) setCurrentStep(3);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    localStorage.setItem("partner-wizard-dismissed", "true");
    onOpenChange(false);
  };

  const handleComplete = async () => {
    try {
      const step1Data = step1Form.getValues();

      await updateOrg.mutateAsync({
        description: step1Data.description,
        website_url: step1Data.website_url || null,
        logo_url: logoUrl || null,
      });

      localStorage.setItem("partner-wizard-dismissed", "true");

      toast({
        title: "Organization profile updated!",
        description: "Your partner organization is now set up.",
      });

      // If they filled step 3 with an opportunity, navigate to create
      const step3Data = step3Form.getValues();
      if (step3Data.opportunityTitle) {
        onComplete?.();
        onOpenChange(false);
        navigate("/partner/opportunities/new");
      } else {
        onComplete?.();
        onOpenChange(false);
      }

      setCurrentStep(1);
    } catch (error) {
      console.error("Failed to save partner org:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save organization profile. Please try again.",
      });
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Maali Partner Portal</DialogTitle>
          <DialogDescription>
            Let's set up your organization profile so applicants can learn about you.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progressPercentage)}% complete</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />

          <div className="flex items-center justify-center gap-4 pt-4">
            {steps.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              const Icon = step.icon;

              return (
                <div key={stepNum} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                        isCompleted && "bg-primary text-primary-foreground border-primary",
                        isCurrent && "bg-primary/10 text-primary border-primary",
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground border-muted"
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={cn(
                      "text-xs mt-2",
                      isCurrent && "font-medium text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {stepNum < totalSteps && <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="py-6">
          {currentStep === 1 && (
            <Form {...step1Form}>
              <form className="space-y-4">
                {partnerOrg?.name && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="text-sm text-muted-foreground">Organization Name</span>
                    <p className="font-medium">{partnerOrg.name}</p>
                  </div>
                )}

                <FormItem>
                  <FormLabel>Organization Logo</FormLabel>
                  <FormControl>
                    <ImageUpload
                      value={logoUrl || undefined}
                      onChange={(url) => setLogoUrl(url || "")}
                      onUpload={uploadImage}
                      onDelete={deleteImage}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                      placeholder="Upload Logo"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">A logo helps applicants recognize your organization</p>
                </FormItem>

                <FormField
                  control={step1Form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Tell applicants about your organization..." className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={step1Form.control}
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://your-organization.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}

          {currentStep === 2 && (
            <Form {...step2Form}>
              <form className="space-y-4">
                <FormField
                  control={step2Form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step2Form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step2Form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country / Region (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Kenya" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}

          {currentStep === 3 && (
            <Form {...step3Form}>
              <form className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Optionally set up your first opportunity now, or skip and do it later from the dashboard.
                </p>
                <FormField
                  control={step3Form.control}
                  name="opportunityTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2026 Innovation Grant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step3Form.control}
                  name="fundingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funding Amount</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. $10,000 - $50,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step3Form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Deadline</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                Back
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button type="button" onClick={handleComplete} disabled={updateOrg.isPending}>
                {updateOrg.isPending ? "Saving..." : "Complete Setup"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}








