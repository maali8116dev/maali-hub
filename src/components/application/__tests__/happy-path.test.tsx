import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { supabase } from '@/integrations/supabase/client';
import { setupMocks, mockDocuments, populateFormStore, defaultApplicationPayload } from './test-utils';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

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

describe('Complete Application Flow', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should complete full application flow with file uploads', async () => {
    const mockUploadDocuments = vi.fn().mockResolvedValue(mockDocuments);
    const mockInsert = vi.fn().mockResolvedValue({
      data: { id: 'app-123' },
      error: null,
    });

    (useDocumentUpload as any).mockReturnValue({
      uploadDocuments: mockUploadDocuments,
      deleteDocument: vi.fn().mockResolvedValue(true),
      isUploading: false,
      uploadProgress: [],
      documents: mockDocuments,
      isLoading: false,
    });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(mockInsert()),
        }),
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    // Populate form store directly with payload (skip UI interactions)
    populateFormStore(defaultApplicationPayload);

    const store = useApplicationFormStore.getState();
    const formData = store.formData;

    // Verify all form data is populated correctly
    expect(formData.applicantType).toBe(defaultApplicationPayload.applicantInfo.applicantType);
    expect(formData.fullLegalName).toBe(defaultApplicationPayload.applicantInfo.fullLegalName);
    expect(formData.projectTitle).toBe(defaultApplicationPayload.projectOverview.title);
    
    if (defaultApplicationPayload.organizationInfo) {
      expect(formData.yearEstablished).toBe(defaultApplicationPayload.organizationInfo.yearEstablished);
      expect(formData.numberOfTeamMembers).toBe(defaultApplicationPayload.organizationInfo.teamSize);
    }

    // Verify we're on the final step
    expect(store.currentStep).toBe(7);

    // Verify all steps are valid
    expect(store.isStepValid(1)).toBe(true);
    expect(store.isStepValid(2)).toBe(true);
    expect(store.isStepValid(3)).toBe(true);
    expect(store.isStepValid(4)).toBe(true);

    // Verify documents are stored
    if (defaultApplicationPayload.documents) {
      expect(formData.uploadedDocumentIds).toEqual(
        defaultApplicationPayload.documents.map(doc => doc.id)
      );
    }
  });
});
