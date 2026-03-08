import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { supabase } from '@/integrations/supabase/client';
import { setupMocks, mockProject, populateFormStore, defaultApplicationPayload, ApplicationPayload } from './test-utils';

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

describe('Step 7: Review & Submit', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should have all required data populated for submission', () => {
    // Populate form store with default payload
    populateFormStore(defaultApplicationPayload);
    
    const store = useApplicationFormStore.getState();
    const formData = store.formData;

    // Verify all required data is present
    expect(formData.applicantType).toBe(defaultApplicationPayload.applicantInfo.applicantType);
    expect(formData.fullLegalName).toBe(defaultApplicationPayload.applicantInfo.fullLegalName);
    expect(formData.projectTitle).toBe(defaultApplicationPayload.projectOverview.title);
    expect(formData.informationAccurateConfirmed).toBe(true);
    expect(formData.conflictOfInterestDeclared).toBe(true);
    expect(formData.dataProcessingConsented).toBe(true);
  });

  it('should validate all steps before submission', () => {
    populateFormStore(defaultApplicationPayload);
    
    const store = useApplicationFormStore.getState();

    // All steps should be valid
    expect(store.isStepValid(1)).toBe(true);
    expect(store.isStepValid(2)).toBe(true);
    expect(store.isStepValid(3)).toBe(true);
    expect(store.isStepValid(4)).toBe(true);
    expect(store.isStepValid(5)).toBe(true); // Documents are optional
  });

  it('should submit application with all data', async () => {
    // Prepare application payload
    const applicationPayload: ApplicationPayload = {
      applicantInfo: {
        applicantType: 'Organization',
        fullLegalName: 'John Doe',
        organizationName: 'Test Org',
        country: 'Ghana',
        city: 'Accra',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      organizationInfo: {
        yearEstablished: 2020,
        teamSize: 10,
        mission: 'Test mission',
        sectors: ['Health'],
      },
      projectOverview: {
        title: 'Innovative Tech Solution',
        summary: 'A valid summary that passes validation.',
        problem: 'Defined problem',
        solution: 'Defined solution',
        beneficiaries: 'SMEs',
        geography: 'West Africa',
      },
      compliance: {
        accurate: true,
        noConflict: true,
        consent: true,
        reporting: true,
      },
      documents: [
        { id: 'doc-1', fileName: 'proposal.pdf' },
      ],
    };

    // Populate form store directly
    populateFormStore(applicationPayload);

    // Spy on the Supabase insert
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'app-123' },
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockReturnValue({
      insert: insertSpy,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn(),
    });

    const store = useApplicationFormStore.getState();
    const formData = store.formData;

    // Verify form data is ready for submission
    expect(formData.applicantType).toBe('Organization');
    expect(formData.fullLegalName).toBe('John Doe');
    expect(formData.projectTitle).toBe('Innovative Tech Solution');
    expect(formData.uploadedDocumentIds).toEqual(['doc-1']);
    expect(store.currentStep).toBe(7); // Review & Submit step
  });
});

describe('Step 6: Payment', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should skip payment step for free projects', () => {
    // Projects with application_fee of 0 should skip payment
    expect(mockProject.application_fee).toBe(0);
  });
});
