import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { setupMocks } from './test-utils';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useProjects');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));
vi.mock('@/hooks/useDocumentUpload');
vi.mock('@/hooks/useNotifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/hooks/useActivityLogger', () => ({
  useActivityLogger: () => ({ logActivity: vi.fn() }),
}));
vi.mock('@/hooks/useAutoSaveDraft', () => ({
  useAutoSaveDraft: () => ({
    isSaving: false,
    lastSavedAt: null,
    draftId: null,
    saveDraft: vi.fn(),
    loadExistingDraft: vi.fn(),
    deleteDraft: vi.fn(),
  }),
}));

describe('Step 3: Project Overview', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should store project overview information correctly', () => {
    const projectData = {
      projectTitle: 'Innovative Tech Solution',
      projectSummary: 'This is a comprehensive project that aims to solve critical problems.',
      problemStatement: 'The current technology landscape lacks innovative solutions.',
      proposedSolution: 'We propose a comprehensive technology platform.',
      targetBeneficiaries: 'Small businesses and entrepreneurs',
      geographicFocus: 'West Africa',
    };

    // Set project information directly in store
    useApplicationFormStore.getState().updateFormData(projectData);

    // Get fresh store reference after update
    const formData = useApplicationFormStore.getState().formData;
    expect(formData.projectTitle).toBe(projectData.projectTitle);
    expect(formData.projectSummary).toBe(projectData.projectSummary);
    expect(formData.problemStatement).toBe(projectData.problemStatement);
    expect(formData.proposedSolution).toBe(projectData.proposedSolution);
    expect(formData.targetBeneficiaries).toBe(projectData.targetBeneficiaries);
    expect(formData.geographicFocus).toBe(projectData.geographicFocus);
  });

  it('should validate step 3 required fields', () => {
    const store = useApplicationFormStore.getState();
    
    // Test with missing required fields
    store.updateFormData({
      projectTitle: '',
      projectSummary: '',
      problemStatement: '',
      proposedSolution: '',
      targetBeneficiaries: '',
      geographicFocus: '',
    });

    // Step 3 should be invalid
    expect(store.isStepValid(3)).toBe(false);

    // Test with all required fields
    store.updateFormData({
      projectTitle: 'Test Project',
      projectSummary: 'Test summary',
      problemStatement: 'Test problem',
      proposedSolution: 'Test solution',
      targetBeneficiaries: 'Test beneficiaries',
      geographicFocus: 'Test geography',
    });

    // Step 3 should be valid
    expect(store.isStepValid(3)).toBe(true);
  });
});
