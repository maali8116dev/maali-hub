import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApplicationFormData {
  // Step 1: Project Selection
  projectId?: number;
  
  // Step 2: Company Information
  companyName?: string;
  contactEmail?: string;
  contactPhone?: string;
  location?: string;
  
  // Step 3: Project Details
  projectDescription?: string;
  fundingAmountRequested?: string;
  businessPlan?: string;
  teamSize?: number;
  
  // Step 4: Documents - track uploaded document IDs for this session
  uploadedDocumentIds?: string[];
}

interface ApplicationFormStore {
  currentStep: number;
  totalSteps: number;
  formData: ApplicationFormData;
  isDirty: boolean;
  lastSaved?: Date;
  draftId?: string;
  
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
  companyName: undefined,
  contactEmail: undefined,
  contactPhone: undefined,
  location: undefined,
  projectDescription: undefined,
  fundingAmountRequested: undefined,
  businessPlan: undefined,
  teamSize: undefined,
  uploadedDocumentIds: [],
};

export const useApplicationFormStore = create<ApplicationFormStore>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 4,
      formData: defaultFormData,
      isDirty: false,
      lastSaved: undefined,
      draftId: undefined,

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
        });
      },

      // Validation helpers
      isStepValid: (step) => {
        const { formData } = get();
        
        switch (step) {
          case 1:
            return !!(
              formData.companyName &&
              formData.contactEmail &&
              formData.location
            );
          case 2:
            return !!(
              formData.projectDescription &&
              formData.fundingAmountRequested
            );
          case 3:
            // Documents are optional, but you can add validation here
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
      partialize: (state) => ({
        formData: state.formData,
        currentStep: state.currentStep,
        lastSaved: state.lastSaved,
      }),
    }
  )
);

