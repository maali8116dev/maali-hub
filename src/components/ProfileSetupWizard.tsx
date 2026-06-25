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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { User, Building, MapPin, CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Step 1: Basic Information Schema
const step1Schema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  country: z.string().min(2, "Country is required"),
});

// Step 2: Work & background schema
const step2Schema = z.object({
  businessName: z.string().optional(),
  businesssector: z.string().min(1, "Field or sector is required"),
  bio: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;
type WizardFormValues = Step1Values & Step2Values;

interface ProfileSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const BUSINESS_sectorS = [
  "Technology",
  "Agriculture",
  "FinTech",
  "Healthcare",
  "Education",
  "Energy",
  "Manufacturing",
  "Retail",
  "Services",
  "Other",
];

const AFRICAN_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cameroon", "Central African Republic", "Chad", "Comoros",
  "Congo", "CÃ´te d'Ivoire", "Djibouti", "Egypt", "Equatorial Guinea",
  "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
  "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar",
  "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
  "Namibia", "Niger", "Nigeria", "Rwanda", "SÃ£o TomÃ© and PrÃ­ncipe",
  "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
  "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda",
  "Zambia", "Zimbabwe"
];

export const ProfileSetupWizard = ({ open, onOpenChange, onComplete }: ProfileSetupWizardProps) => {
  const { t } = useTranslation('common');
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  // Image upload hook
  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "user-avatars",
    folder: user?.id || "",
    maxSizeMB: 5,
  });

  // Step 1 form
  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      firstName: profile?.firstName || "",
      lastName: profile?.lastName || "",
      country: profile?.country || "",
    },
  });

  // Step 2 form
  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      businessName: profile?.businessName || "",
      businesssector: profile?.businesssector || "",
      bio: profile?.bio || "",
    },
  });

  // Update forms when profile loads
  useEffect(() => {
    if (profile) {
      step1Form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        country: profile.country || "",
      });
      step2Form.reset({
        businessName: profile.businessName || "",
        businesssector: profile.businesssector || "",
        bio: profile.bio || "",
      });
      setAvatarUrl(profile.avatarUrl || "");
    }
  }, [profile, step1Form, step2Form]);

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await step1Form.trigger();
      if (isValid) {
        setCurrentStep(2);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  const handleComplete = async () => {
    // Validate both forms before submitting
    const step1Valid = await step1Form.trigger();
    const step2Valid = await step2Form.trigger();

    if (!step1Valid || !step2Valid) {
      // If step 1 is invalid, go back to step 1
      if (!step1Valid) {
        setCurrentStep(1);
        toast({
          variant: "destructive",
          title: t("toasts.profileSetup.validationError"),
          description: t("toasts.profileSetup.step1Incomplete"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("toasts.profileSetup.validationError"),
          description: t("toasts.profileSetup.incomplete"),
        });
      }
      return;
    }

    try {
      const step1Data = step1Form.getValues();
      const step2Data = step2Form.getValues();

      await updateProfile.mutateAsync({
        firstName: step1Data.firstName,
        lastName: step1Data.lastName,
        country: step1Data.country,
        businessName: step2Data.businessName || undefined,
        businesssector: step2Data.businesssector,
        bio: step2Data.bio || undefined,
        avatarUrl: avatarUrl || undefined,
      });

      // Show success message
      toast({
        title: t("toasts.profileSetup.updated"),
        description: t("toasts.profileSetup.updatedDesc"),
      });

      // Call onComplete callback and close dialog
      onComplete?.();
      onOpenChange(false);
      
      // Reset to step 1 for next time
      setCurrentStep(1);
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast({
        variant: "destructive",
        title: t("toasts.error"),
        description: error instanceof Error 
          ? error.message 
          : t("toasts.profileSetup.saveFailed"),
      });
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('profileWizard.title')}</DialogTitle>
          <DialogDescription>{t('profileWizard.description')}</DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t('profileWizard.step', { current: currentStep, total: totalSteps })}</span>
            <span>{Math.round(progressPercentage)}% {t('profileWizard.complete')}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-4 pt-4">
            {[1, 2].map((step) => {
              const isCompleted = step < currentStep;
              const isCurrent = step === currentStep;
              
              return (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                        isCompleted && "bg-primary text-primary-foreground border-primary",
                        isCurrent && "bg-primary/10 text-primary border-primary",
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground border-muted"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className={cn("h-5 w-5", isCurrent && "fill-primary text-primary-foreground")} />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs mt-2",
                      isCurrent && "font-medium text-primary",
                      !isCurrent && "text-muted-foreground"
                    )}>
                      {step === 1 ? t('profileWizard.step1Title') : t('profileWizard.step2Title')}
                    </span>
                  </div>
                  {step < totalSteps && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
                  )}
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
                <FormItem>
                  <FormLabel>{t('profileWizard.profilePicture', 'Profile Picture')}</FormLabel>
                  <FormControl>
                    <ImageUpload
                      value={avatarUrl || undefined}
                      onChange={(url) => setAvatarUrl(url || "")}
                      onUpload={uploadImage}
                      onDelete={deleteImage}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                      placeholder="Upload Profile Picture"
                      variant="avatar"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    {t('profileWizard.profilePictureDescription', 'Upload a profile picture (optional)')}
                  </p>
                </FormItem>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={step1Form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profileWizard.firstName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('profileWizard.firstNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={step1Form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('profileWizard.lastName')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('profileWizard.lastNamePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={step1Form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profileWizard.country')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('profileWizard.countryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {AFRICAN_COUNTRIES.map((country) => (
                            <SelectItem key={country} value={country}>
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  name="businesssector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profileWizard.businesssector')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('profileWizard.businesssectorPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUSINESS_sectorS.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={step2Form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profileWizard.businessName')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('profileWizard.businessNamePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={step2Form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('profileWizard.bio')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('profileWizard.bioPlaceholder')}
                          className="min-h-[100px]"
                          {...field}
                        />
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
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
          >
            {t('profileWizard.skip')}
          </Button>
          
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
              >
                {t('profileWizard.back')}
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button
                type="button"
                onClick={handleNext}
              >
                {t('profileWizard.next')}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleComplete}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? t('profileWizard.saving') : t('profileWizard.complete')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};









