import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { setupMocks } from './test-utils';

// Mock dependencies
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useOpportunities');
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
      projectSummary: 'This is a comprehensive project that aims to solve critical problems in the community. The project will focus on providing innovative solutions through technology and collaboration. We aim to create sustainable impact and improve the quality of life for beneficiaries across multiple regions.',
      geographicFocus: 'West Africa',
    };

    // Set project information directly in store
    useApplicationFormStore.getState().updateFormData(projectData);

    // Get fresh store reference after update
    const formData = useApplicationFormStore.getState().formData;
    expect(formData.projectTitle).toBe(projectData.projectTitle);
    expect(formData.projectSummary).toBe(projectData.projectSummary);
    expect(formData.geographicFocus).toBe(projectData.geographicFocus);
  });

  it('should validate step 3 required fields', () => {
    const store = useApplicationFormStore.getState();
    
    // Test with missing required fields
    store.updateFormData({
      projectTitle: '',
      projectSummary: '',
      geographicFocus: '',
    });

    // Step 3 should be invalid
    expect(store.isStepValid(3)).toBe(false);

    // Test with all required fields (projectSummary needs at least 30 words)
    store.updateFormData({
      projectTitle: 'Innovative Tech Solution Project',
      projectSummary: 'This is a comprehensive project summary that meets the minimum word count requirement. The project aims to solve critical problems through innovative approaches and sustainable solutions. We will work with local communities to ensure maximum impact and long-term success.',
      geographicFocus: 'West Africa',
    });

    // Step 3 should be valid
    expect(store.isStepValid(3)).toBe(true);
  });
});








