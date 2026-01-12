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
  
  // Step 4: Documents (file references)
  documents?: {
    id: string;
    file: File;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
}

interface ApplicationFormStore {
  currentStep: number;
  totalSteps: number;
  formData: ApplicationFormData;
  isDirty: boolean;
  lastSaved?: Date;
  
  // Step navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  
  // Form data management
  updateFormData: (data: Partial<ApplicationFormData>) => void;
  setFormData: (data: ApplicationFormData) => void;
  
  // Document management
  addDocument: (file: File) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  
  // State management
  setDirty: (dirty: boolean) => void;
  markAsSaved: () => void;
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
  documents: [],
};

export const useApplicationFormStore = create<ApplicationFormStore>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      totalSteps: 3,
      formData: defaultFormData,
      isDirty: false,
      lastSaved: undefined,

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

      // Document management
      addDocument: (file) => {
        const document = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        };

        set((state) => ({
          formData: {
            ...state.formData,
            documents: [...(state.formData.documents || []), document],
          },
          isDirty: true,
        }));
      },

      removeDocument: (id) => {
        set((state) => ({
          formData: {
            ...state.formData,
            documents: state.formData.documents?.filter((doc) => doc.id !== id) || [],
          },
          isDirty: true,
        }));
      },

      clearDocuments: () => {
        set((state) => ({
          formData: { ...state.formData, documents: [] },
          isDirty: true,
        }));
      },

      // State management
      setDirty: (dirty) => set({ isDirty: dirty }),
      
      markAsSaved: () => {
        set({ isDirty: false, lastSaved: new Date() });
      },

      reset: () => {
        set({
          currentStep: 1,
          formData: defaultFormData,
          isDirty: false,
          lastSaved: undefined,
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
      // Only persist formData (without File objects) and currentStep
      // File objects can't be serialized, so documents are excluded from persistence
      partialize: (state) => ({
        formData: {
          ...state.formData,
          documents: [], // Exclude File objects from persistence
        },
        currentStep: state.currentStep,
        lastSaved: state.lastSaved,
      }),
    }
  )
);

