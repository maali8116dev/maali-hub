import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApplicationFormData {
  // Step 1: Project Selection
  projectId?: number;
  
  // Step 2: Applicant Information
  applicantType?: 'Individual' | 'Organization' | 'Startup / SME' | 'NGO / Non-profit' | 'Research / Academic';
  fullLegalName?: string;
  organizationName?: string;
  registrationIdNumber?: string;
  countryOfResidence?: string;
  cityRegion?: string;
  emailAddress?: string;
  phoneNumber?: string;
  
  // Step 3: Organizational Background (if applicable)
  yearEstablished?: number;
  coreMissionPurpose?: string;
  primarysectors?: string[]; // Array of sectors: Health, Education, Technology, Agriculture, Environment, Creative, Other
  primarysectorOther?: string;
  numberOfTeamMembers?: number;
  keyTeamMembersRoles?: string;
  previousGrantsFundingReceived?: boolean;
  previousGrantsFundingDetails?: string;
  
  // Step 4: Project Overview
  projectTitle?: string;
  projectSummary?: string;
  geographicFocus?: string;
  
  // Step 5: Social Links
  linkedinUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  otherSocialLinks?: string;
  
  // Step 6: Compliance & Declarations
  informationAccurateConfirmed?: boolean;
  conflictOfInterestDeclared?: boolean;
  reportingRequirementsAgreed?: boolean;
  dataProcessingConsented?: boolean;
  declarationDate?: Date;
  
  // Step 7: Documents - track uploaded document IDs for this session
  uploadedDocumentIds?: string[];
  
  // Payment status
  paymentCompleted?: boolean;
  paymentIntentId?: string;
}

interface ApplicationFormStore {
  currentStep: number;
  totalSteps: number;
  formData: ApplicationFormData;
  isDirty: boolean;
  lastSaved?: Date;
  draftId?: string;
  
  // Selected files for document upload (not persisted - File objects can't be serialized)
  selectedFiles: File[];
  selectedLibraryDocIds: string[];
  
  // Step navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  
  // Form data management
  updateFormData: (data: Partial<ApplicationFormData>) => void;
  setFormData: (data: ApplicationFormData) => void;
  
  // Document management - track uploaded document IDs
  addUploadedDocumentId: (id: string) => void;
  removeUploadedDocumentId: (id: string) => void;
  clearUploadedDocumentIds: () => void;
  getUploadedDocumentIds: () => string[];
  
  // Selected files management (for document upload step)
  setSelectedFiles: (files: File[]) => void;
  setSelectedLibraryDocIds: (ids: string[]) => void;
  clearSelectedFiles: () => void;
  
  // State management
  setDirty: (dirty: boolean) => void;
  markAsSaved: () => void;
  setDraftId: (id: string | null) => void;
  reset: () => void;
  
  // Validation helpers
  isStepValid: (step: number) => boolean;
  canProceedToNextStep: () => boolean;
}

const defaultFormData: ApplicationFormData = {
  projectId: undefined,
  applicantType: undefined,
  fullLegalName: undefined,
  organizationName: undefined,
  registrationIdNumber: undefined,
  countryOfResidence: undefined,
  cityRegion: undefined,
  emailAddress: undefined,
  phoneNumber: undefined,
  yearEstablished: undefined,
  coreMissionPurpose: undefined,
  primarysectors: [],
  primarysectorOther: undefined,
  numberOfTeamMembers: undefined,
  keyTeamMembersRoles: undefined,
  previousGrantsFundingReceived: false,
  previousGrantsFundingDetails: undefined,
  projectTitle: undefined,
  projectSummary: undefined,
  geographicFocus: undefined,
  linkedinUrl: undefined,
  githubUrl: undefined,
  twitterUrl: undefined,
  websiteUrl: undefined,
  otherSocialLinks: undefined,
  informationAccurateConfirmed: false,
  conflictOfInterestDeclared: false,
  reportingRequirementsAgreed: false,
  dataProcessingConsented: false,
  declarationDate: undefined,
  uploadedDocumentIds: [],
  paymentCompleted: false,
  paymentIntentId: undefined,
};

export const useApplicationFormStore = create<ApplicationFormStore>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 8,
      formData: defaultFormData,
      isDirty: false,
      lastSaved: undefined,
      draftId: undefined,
      selectedFiles: [],
      selectedLibraryDocIds: [],

      // Step navigation
      setCurrentStep: (step) => {
        const { totalSteps } = get();
        if (step >= 1 && step <= totalSteps) {
          set({ currentStep: step });
        }
      },

      nextStep: () => {
        const { currentStep, totalSteps, canProceedToNextStep } = get();
        if (canProceedToNextStep() && currentStep < totalSteps) {
          set({ currentStep: currentStep + 1 });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
        }
      },

      goToStep: (step) => {
        const { totalSteps } = get();
        if (step >= 1 && step <= totalSteps) {
          set({ currentStep: step });
        }
      },

      // Form data management
      updateFormData: (data) => {
        set((state) => ({
          formData: { ...state.formData, ...data },
          isDirty: true,
        }));
      },

      setFormData: (data) => {
        set({ formData: data, isDirty: true });
      },

      // Document management - track uploaded document IDs
      addUploadedDocumentId: (id: string) => {
        set((state) => ({
          formData: {
            ...state.formData,
            uploadedDocumentIds: [...(state.formData.uploadedDocumentIds || []), id],
          },
          isDirty: true,
        }));
      },

      removeUploadedDocumentId: (id: string) => {
        set((state) => ({
          formData: {
            ...state.formData,
            uploadedDocumentIds: state.formData.uploadedDocumentIds?.filter((docId) => docId !== id) || [],
          },
          isDirty: true,
        }));
      },

      clearUploadedDocumentIds: () => {
        set((state) => ({
          formData: { ...state.formData, uploadedDocumentIds: [] },
          isDirty: true,
        }));
      },

      getUploadedDocumentIds: () => {
        return get().formData.uploadedDocumentIds || [];
      },

      // Selected files management
      setSelectedFiles: (files) => {
        set({ selectedFiles: files, isDirty: true });
      },

      setSelectedLibraryDocIds: (ids) => {
        set({ selectedLibraryDocIds: ids, isDirty: true });
      },

      clearSelectedFiles: () => {
        set({ selectedFiles: [], selectedLibraryDocIds: [], isDirty: true });
      },

      // State management
      setDirty: (dirty) => set({ isDirty: dirty }),
      
      markAsSaved: () => {
        set({ isDirty: false, lastSaved: new Date() });
      },

      setDraftId: (id) => {
        set({ draftId: id || undefined });
      },

      reset: () => {
        set({
          currentStep: 1,
          formData: defaultFormData,
          isDirty: false,
          lastSaved: undefined,
          draftId: undefined,
          selectedFiles: [],
          selectedLibraryDocIds: [],
        });
      },

      // Validation helpers
      isStepValid: (step) => {
        const { formData } = get();
        
        switch (step) {
          case 1:
            // Applicant Information - required fields
            return !!(
              formData.applicantType &&
              formData.fullLegalName &&
              formData.countryOfResidence &&
              formData.emailAddress &&
              formData.phoneNumber
            );
          case 2:
            // Organizational Background is optional
            return true;
          case 3:
            // Project Overview - required fields
            return !!(
              formData.projectTitle &&
              formData.projectSummary &&
              formData.geographicFocus
            );
          case 4:
            // Social Links - optional, always valid
            return true;
          case 5:
            // Documents are optional
            return true;
          case 6:
            // Review - always valid (read-only step)
            return true;
          case 7:
            // Compliance & Declarations - all must be confirmed
            return !!(
              formData.informationAccurateConfirmed &&
              formData.conflictOfInterestDeclared &&
              formData.reportingRequirementsAgreed &&
              formData.dataProcessingConsented
            );
          case 8:
            // Submit - always valid (final step)
            return true;
          default:
            return false;
        }
      },

      canProceedToNextStep: () => {
        const { currentStep, isStepValid } = get();
        return isStepValid(currentStep);
      },
    }),
    {
      name: 'maali-application-form',
      // Persist formData including uploadedDocumentIds
      // Note: selectedFiles and selectedLibraryDocIds are NOT persisted
      // because File objects can't be serialized. They persist in memory during navigation.
      partialize: (state) => ({
        formData: state.formData,
        currentStep: state.currentStep,
        lastSaved: state.lastSaved,
        // Explicitly exclude selectedFiles and selectedLibraryDocIds from persistence
      }),
    }
  )
);









