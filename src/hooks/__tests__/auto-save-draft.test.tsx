import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoSaveDraft } from '../useAutoSaveDraft';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '../use-toast';
import { ApplicationFormData } from '@/stores/applicationForm';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));
vi.mock('@/hooks/use-toast');

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
};

const mockFormData: ApplicationFormData = {
  projectId: 1,
  applicantType: 'Individual',
  fullLegalName: 'John Doe',
  organizationName: '',
  countryOfResidence: 'Ghana',
  cityRegion: 'Accra',
  emailAddress: 'john@example.com',
  phoneNumber: '+1234567890',
  projectTitle: 'Test Project',
  projectSummary: 'Test project description',
  numberOfTeamMembers: 10,
};

describe('useAutoSaveDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({
      toast: vi.fn(),
    });
  });

  describe('saveDraft', () => {
    it('should reject save when projectId is not provided', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const formDataWithoutProject = { ...mockFormData, projectId: undefined };
      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: formDataWithoutProject, onSaved }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(result.current.isSaving).toBe(false);
      expect(onSaved).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should reject save when user is not authenticated', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(result.current.isSaving).toBe(false);
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('should create a new draft when no draftId exists', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDraftData = {
        id: 'draft-1',
        user_id: 'user-1',
        project_id: 1,
        company_name: 'Test Company',
        contact_email: 'contact@test.com',
        contact_phone: '+1234567890',
        location: 'Ghana',
        project_description: 'Test project description',
        business_plan: 'Test business plan',
        team_size: 10,
        status: 'draft',
        is_draft: true,
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null, // No existing draft
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDraftData,
          error: null,
        }),
      };

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount === 1) {
            return mockCheckQuery; // First call: check for existing draft
          }
          return mockInsertQuery; // Second call: insert new draft
        }
        return mockCheckQuery;
      });

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      expect(result.current.draftId).toBe('draft-1');
      expect(result.current.lastSavedAt).not.toBeNull();
      expect(onSaved).toHaveBeenCalled();
      expect(mockInsertQuery.insert).toHaveBeenCalled();
    });

    it('should update existing draft when draftId exists', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDraftData = {
        id: 'draft-1',
        user_id: 'user-1',
        project_id: 1,
        company_name: 'Updated Company',
        contact_email: 'updated@test.com',
        status: 'draft',
        is_draft: true,
        updated_at: '2024-01-02T00:00:00Z',
      };

      // First save creates the draft
      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockDraftData, id: 'draft-1' },
          error: null,
        }),
      };

      // Second save updates the draft
      const mockDraftGuardQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { is_draft: true },
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockDraftData, company_name: 'Updated Company' },
          error: null,
        }),
      };

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount === 1) return mockCheckQuery; // First save: check
          if (callCount === 2) return mockInsertQuery; // First save: insert
          if (callCount === 3) return mockDraftGuardQuery; // Second save: guard check
          if (callCount === 4) return mockUpdateQuery; // Second save: update
          return mockUpdateQuery;
        }
        return mockCheckQuery;
      });

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        { wrapper: createWrapper() }
      );

      // First save to create draft
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.draftId).toBe('draft-1');
      });

      // Second save to update draft
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      expect(mockUpdateQuery.update).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalledTimes(2);
    });

    it('should update existing draft when found by projectId', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const existingDraft = { id: 'draft-1' };
      const mockDraftData = {
        id: 'draft-1',
        user_id: 'user-1',
        project_id: 1,
        company_name: 'Test Company',
        status: 'draft',
        is_draft: true,
      };

      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingDraft,
          error: null,
        }),
      };

      const mockUpdateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockDraftData,
          error: null,
        }),
      };

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount === 1) {
            return mockCheckQuery; // First call: check for existing draft
          }
          return mockUpdateQuery; // Second call: update existing draft
        }
        return mockCheckQuery;
      });

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      expect(result.current.draftId).toBe('draft-1');
      expect(mockUpdateQuery.update).toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount === 1) {
            return mockCheckQuery;
          }
          return mockInsertQuery;
        }
        return mockCheckQuery;
      });

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.isSaving).toBe(false);
      });

      expect(result.current.error).toBe('Failed to save draft');
      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe('loadExistingDraft', () => {
    it('should return null when projectId is not provided', async () => {
      const formDataWithoutProject = { ...mockFormData, projectId: undefined };

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: formDataWithoutProject, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result.current.loadExistingDraft();
      });

      expect(loadedDraft).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return null when user is not authenticated', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result.current.loadExistingDraft();
      });

      expect(loadedDraft).toBeNull();
    });

    it('should load existing draft successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const existingDraft = {
        id: 'draft-1',
        user_id: 'user-1',
        project_id: 1,
        organization_name: 'Test Company',
        contact_email: 'contact@test.com',
        contact_phone: '+1234567890',
        country_of_residence: 'Ghana',
        project_summary: 'Test project description',
        team_size: 10,
        is_draft: true,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: existingDraft,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result.current.loadExistingDraft();
      });

      expect(loadedDraft).not.toBeNull();
      expect(loadedDraft?.organizationName).toBe('Test Company');
      expect(loadedDraft?.emailAddress).toBe('contact@test.com');
      expect(result.current.draftId).toBe('draft-1');
    });

    it('should return null when no draft exists', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result.current.loadExistingDraft();
      });

      expect(loadedDraft).toBeNull();
    });

    it('should handle load errors gracefully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockQuery);

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result.current.loadExistingDraft();
      });

      expect(loadedDraft).toBeNull();
    });
  });

  describe('deleteDraft', () => {
    it('should do nothing when draftId is not set', async () => {
      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.deleteDraft();
      });

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should delete draft successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Setup for creating a draft first
      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'draft-1', user_id: 'user-1', project_id: 1, is_draft: true },
          error: null,
        }),
      };

      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      
      // Chain the second eq to return resolved value
      mockDeleteQuery.eq.mockImplementation((key: string, value: any) => {
        if (key === 'is_draft') {
          return Promise.resolve({ data: null, error: null });
        }
        return mockDeleteQuery;
      });

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount <= 2) {
            // First two calls for save
            return callCount === 1 ? mockCheckQuery : mockInsertQuery;
          }
          // Third call for delete
          return mockDeleteQuery;
        }
        return mockCheckQuery;
      });

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      // First create a draft
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.draftId).toBe('draft-1');
      });

      // Then delete it
      await act(async () => {
        await result.current.deleteDraft();
      });

      expect(mockDeleteQuery.delete).toHaveBeenCalled();
      expect(result.current.draftId).toBeNull();
    });

    it('should handle delete errors gracefully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Setup for creating a draft first
      const mockCheckQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'draft-1', user_id: 'user-1', project_id: 1, is_draft: true },
          error: null,
        }),
      };

      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      
      // Chain the second eq to return error
      mockDeleteQuery.eq.mockImplementation((key: string, value: any) => {
        if (key === 'is_draft') {
          return Promise.resolve({ data: null, error: { message: 'Database error' } });
        }
        return mockDeleteQuery;
      });

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'applications') {
          callCount++;
          if (callCount <= 2) {
            return callCount === 1 ? mockCheckQuery : mockInsertQuery;
          }
          return mockDeleteQuery;
        }
        return mockCheckQuery;
      });

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved: vi.fn() }),
        { wrapper: createWrapper() }
      );

      // First create a draft
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(() => {
        expect(result.current.draftId).toBe('draft-1');
      });

      // Then try to delete it (should fail gracefully)
      await act(async () => {
        await result.current.deleteDraft();
      });

      // Should not throw, but draftId should remain (error is handled internally)
      expect(mockDeleteQuery.delete).toHaveBeenCalled();
    });
  });
});

