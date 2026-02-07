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

describe('Step 1: Applicant Information', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should store applicant information correctly', () => {
    // Set applicant information directly in store
    useApplicationFormStore.getState().updateFormData({
      applicantType: 'Organization',
      fullLegalName: 'John Doe',
      organizationName: 'Test Organization Inc.',
      registrationIdNumber: 'REG123456',
      countryOfResidence: 'Ghana',
      cityRegion: 'Accra',
      emailAddress: 'john@example.com',
      phoneNumber: '+1234567890',
    });

    // Get fresh store reference after update
    const formData = useApplicationFormStore.getState().formData;
    expect(formData.applicantType).toBe('Organization');
    expect(formData.fullLegalName).toBe('John Doe');
    expect(formData.organizationName).toBe('Test Organization Inc.');
    expect(formData.countryOfResidence).toBe('Ghana');
    expect(formData.emailAddress).toBe('john@example.com');
    expect(formData.phoneNumber).toBe('+1234567890');
  });

  it('should validate required fields for step 1', () => {
    const store = useApplicationFormStore.getState();
    
    // Test with missing required fields
    store.updateFormData({
      applicantType: undefined,
      fullLegalName: '',
      countryOfResidence: '',
      emailAddress: '',
      phoneNumber: '',
    });

    // Step 1 should be invalid
    expect(store.isStepValid(1)).toBe(false);

    // Test with all required fields
    store.updateFormData({
      applicantType: 'Organization',
      fullLegalName: 'John Doe',
      countryOfResidence: 'Ghana',
      emailAddress: 'john@example.com',
      phoneNumber: '+1234567890',
    });

    // Step 1 should be valid
    expect(store.isStepValid(1)).toBe(true);
  });

  it('should handle organization name for non-Individual applicants', () => {
    // For Organization type, organization name should be stored
    useApplicationFormStore.getState().updateFormData({
      applicantType: 'Organization',
      organizationName: 'Test Org',
    });

    expect(useApplicationFormStore.getState().formData.organizationName).toBe('Test Org');

    // For Individual type, organization name is not required
    useApplicationFormStore.getState().updateFormData({
      applicantType: 'Individual',
      organizationName: undefined,
    });

    expect(useApplicationFormStore.getState().formData.organizationName).toBeUndefined();
  });
});
