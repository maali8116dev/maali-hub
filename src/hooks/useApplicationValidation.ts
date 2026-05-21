/**
 * Hook for application form validation logic
 */
import { useToast } from '@/hooks/use-toast';
import { useApplicationFormStore } from '@/stores/applicationForm';

export function useApplicationValidation(isGrantType = true) {
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
        title: "Missing Information",
        description: "Please complete all required fields before submitting.",
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
        title: "Compliance Required",
        description: "Please confirm all compliance declarations before submitting.",
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









