/**
 * Hook for application form validation logic
 */
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useApplicationFormStore } from "@/stores/applicationForm";

export function useApplicationValidation(isGrantType = true) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { formData } = useApplicationFormStore();

  const validateRequiredFields = (): boolean => {
    if (
      !formData.applicantType ||
      !formData.fullLegalName ||
      !formData.countryOfResidence ||
      !formData.cityRegion ||
      !formData.emailAddress ||
      !formData.phoneNumber ||
      !formData.projectTitle ||
      !formData.projectSummary
    ) {
      toast({
        title: t("applications.form.toasts.missingInformation.title"),
        description: t("applications.form.toasts.missingInformation.description"),
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateCompliance = (): boolean => {
    if (
      !formData.informationAccurateConfirmed ||
      !formData.conflictOfInterestDeclared ||
      (isGrantType && !formData.reportingRequirementsAgreed) ||
      !formData.dataProcessingConsented
    ) {
      toast({
        title: t("applications.form.toasts.complianceRequired.title"),
        description: t("applications.form.toasts.complianceRequired.description"),
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateAll = (): boolean => {
    return validateRequiredFields() && validateCompliance();
  };

  return {
    validateRequiredFields,
    validateCompliance,
    validateAll,
  };
}
