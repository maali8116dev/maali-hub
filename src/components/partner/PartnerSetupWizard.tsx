import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { useToast } from "@/hooks/use-toast";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Building, Globe, Rocket, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createPartnerSetupSchemas,
  type Step1Values,
  type Step2Values,
  type Step3Values,
} from "@/lib/schemas/partnerSetupWizard.schema";
import { COUNTRIES } from "@/components/application/form/countries";

interface PartnerSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function PartnerSetupWizard({ open, onOpenChange, onComplete }: PartnerSetupWizardProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const { data: partnerOrg } = usePartnerOrg();
  const updateOrg = useUpdatePartnerOrg();
  const [logoUrl, setLogoUrl] = useState<string>("");

  const { step1Schema, step2Schema, step3Schema } = useMemo(
    () => createPartnerSetupSchemas(t),
    [t],
  );

  const steps = useMemo(
    () => [
      { label: t("partner.setupWizard.steps.organization"), icon: Building },
      { label: t("partner.setupWizard.steps.contact"), icon: Globe },
      { label: t("partner.setupWizard.steps.firstOpportunity"), icon: Rocket },
    ],
    [t],
  );

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "partner-logos",
    folder: `partner-logos/${user?.id || ""}`,
    maxSizeMB: 5,
  });

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { description: "", website_url: "" },
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
      step2Form.reset({
        contactName: partnerOrg.contact_name || "",
        contactPhone: partnerOrg.contact_phone || "",
        country: partnerOrg.contact_country || "",
      });
      setLogoUrl(partnerOrg.logo_url || "");
    }
  }, [partnerOrg, step1Form, step2Form]);

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

  const handleSkip = async () => {
    await updateOrg.mutateAsync({ onboarding_dismissed_at: new Date().toISOString() });
    onOpenChange(false);
  };

  const handleComplete = async () => {
    try {
      const step1Data = step1Form.getValues();
      const step2Data = step2Form.getValues();

      await updateOrg.mutateAsync({
        description: step1Data.description,
        website_url: step1Data.website_url || null,
        logo_url: logoUrl || null,
        contact_name: step2Data.contactName || null,
        contact_phone: step2Data.contactPhone || null,
        contact_country: step2Data.country || null,
        onboarding_dismissed_at: new Date().toISOString(),
      });

      toast({
        title: t("partner.setupWizard.toasts.updated"),
        description: t("partner.setupWizard.toasts.updatedDesc"),
      });

      const step3Data = step3Form.getValues();
      onComplete?.();
      onOpenChange(false);
      setCurrentStep(1);
      if (step3Data.opportunityTitle && partnerOrg?.id) {
        navigate("/partner/opportunities/new", {
          state: {
            prefill: {
              title: step3Data.opportunityTitle,
              fundingAmount: step3Data.fundingAmount,
              deadline: step3Data.deadline,
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to save partner org:", error);
      toast({
        variant: "destructive",
        title: t("partner.setupWizard.toasts.error"),
        description: t("partner.setupWizard.toasts.errorDesc"),
      });
    }
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("partner.setupWizard.title")}</DialogTitle>
          <DialogDescription>{t("partner.setupWizard.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("partner.setupWizard.stepOf", { current: currentStep, total: totalSteps })}</span>
            <span>{t("partner.setupWizard.percentComplete", { percent: Math.round(progressPercentage) })}</span>
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
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground border-muted",
                      )}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2",
                        isCurrent && "font-medium text-primary",
                        !isCurrent && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {stepNum < totalSteps && <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="py-6">
          {currentStep === 1 && (
            <Form {...step1Form}>
              <form className="space-y-4">
                {partnerOrg?.name && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <span className="text-sm text-muted-foreground">
                      {t("partner.settingsPage.orgProfile.name")}
                    </span>
                    <p className="font-medium">{partnerOrg.name}</p>
                  </div>
                )}

                <FormItem>
                  <FormLabel>{t("partner.settingsPage.orgProfile.logo")}</FormLabel>
                  <FormControl>
                    <ImageUpload
                      value={logoUrl || undefined}
                      onChange={(url) => setLogoUrl(url || "")}
                      onUpload={uploadImage}
                      onDelete={deleteImage}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                      placeholder={t("partner.settingsPage.orgProfile.uploadLogo")}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{t("partner.setupWizard.logoHint")}</p>
                </FormItem>

                <CustomFormField
                  control={step1Form.control}
                  name="description"
                  label={t("partner.settingsPage.orgProfile.descriptionLabel")}
                  fieldType={FormFieldType.TEXTAREA}
                  placeholder={t("partner.settingsPage.orgProfile.descriptionPlaceholder")}
                />

                <CustomFormField
                  control={step1Form.control}
                  name="website_url"
                  label={t("partner.settingsPage.orgProfile.website")}
                  fieldType={FormFieldType.URL}
                  placeholder={t("partner.settingsPage.orgProfile.websitePlaceholder")}
                />
              </form>
            </Form>
          )}

          {currentStep === 2 && (
            <Form {...step2Form}>
              <form className="space-y-4">
                <CustomFormField
                  control={step2Form.control}
                  name="contactName"
                  label={t("partner.settingsPage.contact.name")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("partner.settingsPage.contact.namePlaceholder")}
                />
                <CustomFormField
                  control={step2Form.control}
                  name="contactPhone"
                  label={t("partner.settingsPage.contact.phone")}
                  fieldType={FormFieldType.TEL}
                  placeholder={t("partner.settingsPage.contact.phonePlaceholder")}
                />
                <CustomFormField
                  control={step2Form.control}
                  name="country"
                  label={t("partner.settingsPage.contact.country")}
                  fieldType={FormFieldType.SELECT}
                  placeholder={t("partner.settingsPage.contact.countryPlaceholder")}
                  options={COUNTRIES}
                />
              </form>
            </Form>
          )}

          {currentStep === 3 && (
            <Form {...step3Form}>
              <form className="space-y-4">
                <p className="text-sm text-muted-foreground">{t("partner.setupWizard.step3Intro")}</p>
                <CustomFormField
                  control={step3Form.control}
                  name="opportunityTitle"
                  label={t("partner.setupWizard.fields.opportunityTitle")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("partner.setupWizard.fields.opportunityTitlePlaceholder")}
                />
                <CustomFormField
                  control={step3Form.control}
                  name="fundingAmount"
                  label={t("partner.setupWizard.fields.fundingAmount")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("partner.setupWizard.fields.fundingAmountPlaceholder")}
                />
                <FormField
                  control={step3Form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("partner.setupWizard.fields.deadline")}</FormLabel>
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

        <div className="flex items-center justify-between pt-4 border-t">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            {t("partner.setupWizard.actions.skip")}
          </Button>
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrevious}>
                {t("partner.setupWizard.actions.back")}
              </Button>
            )}
            {currentStep < totalSteps ? (
              <Button type="button" onClick={handleNext}>
                {t("partner.setupWizard.actions.next")}
              </Button>
            ) : (
              <Button type="button" onClick={handleComplete} disabled={updateOrg.isPending}>
                {updateOrg.isPending
                  ? t("partner.setupWizard.actions.saving")
                  : t("partner.setupWizard.actions.complete")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
