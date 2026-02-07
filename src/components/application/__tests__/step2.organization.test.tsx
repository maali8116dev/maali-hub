import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { setupMocks, populateFormStore, defaultApplicationPayload } from './test-utils';

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

describe('Step 2: Organizational Background', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should store organizational background information correctly', () => {
    // Set organizational information directly in store
    useApplicationFormStore.getState().updateFormData({
      applicantType: 'Organization',
      yearEstablished: 2020,
      numberOfTeamMembers: 10,
      coreMissionPurpose: 'Our mission is to create innovative solutions for social impact.',
      primarySectors: ['Health', 'Technology'],
      keyTeamMembersRoles: 'John Doe - CEO, Jane Smith - CTO',
    });

    // Get fresh store reference after update
    const formData = useApplicationFormStore.getState().formData;
    expect(formData.yearEstablished).toBe(2020);
    expect(formData.numberOfTeamMembers).toBe(10);
    expect(formData.coreMissionPurpose).toBe('Our mission is to create innovative solutions for social impact.');
    expect(formData.primarySectors).toEqual(['Health', 'Technology']);
    expect(formData.keyTeamMembersRoles).toBe('John Doe - CEO, Jane Smith - CTO');
  });

  it('should validate step 2 for Organization applicants', () => {
    const store = useApplicationFormStore.getState();
    
    // Set applicant type to Organization
    store.updateFormData({
      applicantType: 'Organization',
    });

    // Test with missing required fields
    store.updateFormData({
      yearEstablished: undefined,
      coreMissionPurpose: '',
      primarySectors: [],
      numberOfTeamMembers: undefined,
    });

    // Step 2 should be invalid
    expect(store.isStepValid(2)).toBe(false);

    // Test with all required fields
    store.updateFormData({
      yearEstablished: 2020,
      coreMissionPurpose: 'Test mission',
      primarySectors: ['Health'],
      numberOfTeamMembers: 10,
    });

    // Step 2 should be valid
    expect(store.isStepValid(2)).toBe(true);
  });

  it('should skip step 2 validation for Individual applicants', () => {
    const store = useApplicationFormStore.getState();
    
    // Set applicant type to Individual
    store.updateFormData({
      applicantType: 'Individual',
    });

    // Step 2 should always be valid for Individuals (skipped)
    expect(store.isStepValid(2)).toBe(true);

    // Even with no organizational data, it should be valid
    store.updateFormData({
      yearEstablished: undefined,
      coreMissionPurpose: undefined,
      primarySectors: undefined,
      numberOfTeamMembers: undefined,
    });

    expect(store.isStepValid(2)).toBe(true);
  });
});
