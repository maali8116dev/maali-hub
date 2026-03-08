import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { useApplicationFormStore } from '@/stores/applicationForm';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { setupMocks, mockDocuments } from './test-utils';

// Helper to load actual files from the test files directory
const loadTestFile = (filename: string, mimeType: string): File => {
  const filePath = join(process.cwd(), 'src', 'test', 'files', filename);
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
};

// Load test files
const testPDF = () => loadTestFile('test-document.pdf', 'application/pdf');
const testDOC = () => loadTestFile('test-document.doc', 'application/msword');
const testDOCX = () => loadTestFile('test-document.txt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
const testTXT = () => loadTestFile('text-document.txt', 'text/plain');

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

describe('Step 5: Document Upload', () => {
  beforeEach(() => {
    setupMocks();
    (useDocumentUpload as any).mockReturnValue({
      uploadDocuments: vi.fn().mockResolvedValue(mockDocuments),
      deleteDocument: vi.fn().mockResolvedValue(true),
      isUploading: false,
      uploadProgress: [],
      documents: [],
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should store uploaded document IDs', () => {
    // Add document IDs directly
    useApplicationFormStore.getState().addUploadedDocumentId('doc-1');
    useApplicationFormStore.getState().addUploadedDocumentId('doc-2');

    // Get fresh store reference after updates
    const store = useApplicationFormStore.getState();
    
    // Verify document IDs are stored
    expect(store.getUploadedDocumentIds()).toEqual(['doc-1', 'doc-2']);
    expect(store.formData.uploadedDocumentIds).toEqual(['doc-1', 'doc-2']);
  });

  it('should remove uploaded document IDs', () => {
    const store = useApplicationFormStore.getState();
    
    // Add document IDs
    store.addUploadedDocumentId('doc-1');
    store.addUploadedDocumentId('doc-2');
    store.addUploadedDocumentId('doc-3');

    // Remove one document ID
    store.removeUploadedDocumentId('doc-2');

    // Verify document ID was removed
    expect(store.getUploadedDocumentIds()).toEqual(['doc-1', 'doc-3']);
  });

  it('should clear all uploaded document IDs', () => {
    const store = useApplicationFormStore.getState();
    
    // Add document IDs
    store.addUploadedDocumentId('doc-1');
    store.addUploadedDocumentId('doc-2');

    // Clear all document IDs
    store.clearUploadedDocumentIds();

    // Verify all document IDs are cleared
    expect(store.getUploadedDocumentIds()).toEqual([]);
  });

  it('should handle document upload hook', async () => {
    const mockUploadDocuments = vi.fn().mockResolvedValue(mockDocuments);

    (useDocumentUpload as any).mockReturnValue({
      uploadDocuments: mockUploadDocuments,
      deleteDocument: vi.fn().mockResolvedValue(true),
      isUploading: false,
      uploadProgress: [],
      documents: [],
      isLoading: false,
    });

    const { uploadDocuments } = useDocumentUpload();
    const testFile = testPDF();
    const result = await uploadDocuments([testFile]);

    expect(mockUploadDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'test-document.pdf', type: 'application/pdf' })
      ])
    );
    expect(result).toEqual(mockDocuments);
  });

  it('should handle multiple document uploads', async () => {
    const mockUploadDocuments = vi.fn().mockResolvedValue(mockDocuments);

    (useDocumentUpload as any).mockReturnValue({
      uploadDocuments: mockUploadDocuments,
      deleteDocument: vi.fn().mockResolvedValue(true),
      isUploading: false,
      uploadProgress: [],
      documents: [],
      isLoading: false,
    });

    const { uploadDocuments } = useDocumentUpload();
    const files = [
      testPDF(),
      testDOC(),
      testTXT(),
    ];

    await uploadDocuments(files);

    expect(mockUploadDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'test-document.pdf', type: 'application/pdf' }),
        expect.objectContaining({ name: 'test-document.doc', type: 'application/msword' }),
        expect.objectContaining({ name: 'text-document.txt', type: 'text/plain' }),
      ])
    );
  });
});
