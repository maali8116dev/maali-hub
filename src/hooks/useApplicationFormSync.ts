/**
 * Hook to synchronize react-hook-form with Zustand store
 */
import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useApplicationFormStore, type ApplicationFormData } from '@/stores/applicationForm';
import type { ApplicationFormValues } from '@/components/application/form/schemas';

export function useApplicationFormSync(
  form: UseFormReturn<ApplicationFormValues>,
  currentStep: number
) {
  const { formData, updateFormData } = useApplicationFormStore();
  const isResettingRef = useRef(false);

  // Update form when step changes
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
      primarysectors: formData.primarysectors || [],
      primarysectorOther: formData.primarysectorOther || "",
      numberOfTeamMembers: formData.numberOfTeamMembers || undefined,
      keyTeamMembersRoles: formData.keyTeamMembersRoles || "",
      previousGrantsFundingReceived: formData.previousGrantsFundingReceived || false,
      previousGrantsFundingDetails: formData.previousGrantsFundingDetails || "",
      projectTitle: formData.projectTitle || "",
      projectSummary: formData.projectSummary || "",
      geographicFocus: formData.geographicFocus || "",
      informationAccurateConfirmed: formData.informationAccurateConfirmed || false,
      conflictOfInterestDeclared: formData.conflictOfInterestDeclared || false,
      reportingRequirementsAgreed: formData.reportingRequirementsAgreed || false,
      dataProcessingConsented: formData.dataProcessingConsented || false,
      declarationDate: formData.declarationDate || undefined,
      documents: [],
    });
    requestAnimationFrame(() => {
      isResettingRef.current = false;
    });
  }, [currentStep, form, formData]);

  // Watch form values and sync with store
  useEffect(() => {
    const subscription = form.watch((value) => {
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
        primarysectors: value.primarysectors as string[] | undefined,
        primarysectorOther: value.primarysectorOther as string | undefined,
        numberOfTeamMembers: value.numberOfTeamMembers as number | undefined,
        keyTeamMembersRoles: value.keyTeamMembersRoles as string | undefined,
        previousGrantsFundingReceived: value.previousGrantsFundingReceived as boolean | undefined,
        previousGrantsFundingDetails: value.previousGrantsFundingDetails as string | undefined,
        projectTitle: value.projectTitle as string | undefined,
        projectSummary: value.projectSummary as string | undefined,
        geographicFocus: value.geographicFocus as string | undefined,
        informationAccurateConfirmed: value.informationAccurateConfirmed as boolean,
        conflictOfInterestDeclared: value.conflictOfInterestDeclared as boolean,
        reportingRequirementsAgreed: value.reportingRequirementsAgreed as boolean,
        dataProcessingConsented: value.dataProcessingConsented as boolean,
        declarationDate: value.declarationDate as Date | undefined,
      });
    });

    return () => subscription.unsubscribe();
  }, [form, updateFormData, formData]);

  return { isResettingRef };
}









