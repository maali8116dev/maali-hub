/**
 * Helper to get default form values from store data
 */
import type { ApplicationFormData } from '@/stores/applicationForm';
import type { ApplicationFormValues } from './schemas';

export function getFormDefaults(formData: ApplicationFormData): Partial<ApplicationFormValues> {
  return {
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
  };
}









