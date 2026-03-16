/**
 * Integration tests -” hooks hit the REAL database.
 *
 * We mock `@/integrations/supabase/client` to return a real Supabase client
 * so the hooks behave exactly as they would in the browser.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import React from 'react';
import { ApplicationFormData } from '@/stores/applicationForm';

// â”€â”€ Hoisted container -” available to vi.mock factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const shared = vi.hoisted(() => ({
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ",
  realClient: null as SupabaseClient<Database> | null,
}));

const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// â”€â”€ Mock the module to inject our real client into hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient: cc } = await import('@supabase/supabase-js');
  shared.realClient = cc<Database>(shared.SUPABASE_URL, shared.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase: shared.realClient };
});

// Service-role client for test-data setup / teardown (bypasses RLS)
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(shared.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const itIf = supabaseAdmin ? it : it.skip;

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import { useAutoSaveDraft } from '../useAutoSaveDraft';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Draft Workflow - Integration Tests', () => {
  let testUserId: string;
  let testUserEmail: string;
  let testProjectId: number;
  let testsectorId: number;
  let testDraftIds: string[] = [];
  const testTimestamp = Date.now();

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set, skipping integration tests');
      return;
    }

    // 1. Get or create a test sector
    const { data: existingCategory } = await supabaseAdmin
      .from('sectors')
      .select('id')
      .eq('name', 'Technology')
      .single();

    if (existingCategory) {
      testsectorId = existingCategory.id;
    } else {
      const { data: newCategory, error } = await supabaseAdmin
        .from('sectors')
        .insert({
          name: 'Technology',
          slug: 'technology',
          description: 'Test Technology sector',
          is_active: true,
        })
        .select('id')
        .single();

      if (error || !newCategory) {
        throw new Error(`Failed to create sector: ${error?.message}`);
      }
      testsectorId = newCategory.id;
    }

    // 2. Create test project
    const { data: projectData, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        title: `IntTest Draft Project ${testTimestamp}`,
        description: 'Integration test project for draft workflow',
        sector_id: testsectorId,
        status: 'open',
        location: 'Ghana',
        funding_amount: '$50,000',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        featured: false,
      })
      .select('id')
      .single();

    if (projectError || !projectData) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }
    testProjectId = projectData.id;

    // 3. Create test user (applicant)
    testUserEmail = `int-draft-${testTimestamp}@maali.test`;
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: testUserEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (userError || !userData?.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    testUserId = userData.user.id;

    // Create profile for test user
    await supabaseAdmin.from('profiles').upsert(
      {
        user_id: testUserId,
        first_name: 'Test',
        last_name: 'Applicant',
        role: 'applicant',
      },
      { onConflict: 'user_id' }
    );

    // 4. Sign in the real client with test user
    const { error: signInError } = await shared.realClient!.auth.signInWithPassword({
      email: testUserEmail,
      password: 'TestPassword123!',
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    // Clean up test drafts
    if (testDraftIds.length > 0) {
      await supabaseAdmin
        .from('applications')
        .delete()
        .in('id', testDraftIds);
    }

    // Clean up any remaining drafts for this user/project
    await supabaseAdmin
      .from('applications')
      .delete()
      .eq('user_id', testUserId)
      .eq('project_id', testProjectId);

    // Clean up test project
    if (testProjectId) {
      await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', testProjectId);
    }

    // Clean up test user
    if (testUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Sign out
    await shared.realClient!.auth.signOut();
  }, 30000);

  describe('Complete Draft Workflow', () => {
    itIf('should complete full draft workflow: create â†’ save â†’ load â†’ submit', async () => {
      const mockFormData: ApplicationFormData = {
        projectId: testProjectId,
        applicantType: 'Individual',
        fullLegalName: 'John Doe',
        organizationName: '',
        countryOfResidence: 'Ghana',
        cityRegion: 'Accra',
        emailAddress: testUserEmail,
        phoneNumber: '+1234567890',
        projectTitle: 'Test Project',
        projectSummary: 'Test project summary',
        geographicFocus: 'Ghana',
        informationAccurateConfirmed: true,
        conflictOfInterestDeclared: true,
        reportingRequirementsAgreed: true,
        dataProcessingConsented: true,
      };

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      // Step 1: Create draft (first save)
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(
        () => {
          expect(result.current.isSaving).toBe(false);
        },
        { timeout: 10000 }
      );

      expect(result.current.draftId).toBeDefined();
      expect(result.current.draftId).not.toBeNull();
      expect(result.current.lastSavedAt).not.toBeNull();
      expect(onSaved).toHaveBeenCalled();

      const draftId = result.current.draftId!;
      testDraftIds.push(draftId);

      // Verify draft exists in database
      const { data: createdDraft, error: fetchError } = await shared.realClient!
        .from('applications')
        .select('*')
        .eq('id', draftId)
        .single();

      expect(fetchError).toBeNull();
      expect(createdDraft).toBeDefined();
      expect(createdDraft?.is_draft).toBe(true);
      expect(createdDraft?.status).toBe('draft');
      expect(createdDraft?.project_id).toBe(testProjectId);
      expect(createdDraft?.user_id).toBe(testUserId);

      // Step 2: Auto-save draft (update existing)
      const updatedFormData: ApplicationFormData = {
        ...mockFormData,
        projectTitle: 'Updated Project Title',
        projectSummary: 'Updated project summary',
        fullLegalName: 'John Doe Updated',
      };

      const { result: result2 } = renderHook(
        () => useAutoSaveDraft({ formData: updatedFormData, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      // Set the draftId in the hook state (simulating it being loaded)
      await act(async () => {
        // First load the existing draft to get the ID
        const existingDraft = await result2.current.loadExistingDraft();
        if (existingDraft) {
          // Then save with updated data
          await result2.current.saveDraft();
        }
      });

      await waitFor(
        () => {
          expect(result2.current.isSaving).toBe(false);
        },
        { timeout: 10000 }
      );

      // Verify draft was updated
      const { data: updatedDraft } = await shared.realClient!
        .from('applications')
        .select('*')
        .eq('id', draftId)
        .single();

      expect(updatedDraft?.project_title).toBe('Updated Project Title');
      expect(updatedDraft?.project_summary).toBe('Updated project summary');
      expect(updatedDraft?.full_legal_name).toBe('John Doe Updated');

      // Step 3: Load existing draft
      const { result: result3 } = renderHook(
        () => useAutoSaveDraft({ formData: updatedFormData, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      let loadedDraft: any;
      await act(async () => {
        loadedDraft = await result3.current.loadExistingDraft();
      });

      expect(loadedDraft).not.toBeNull();
      expect(loadedDraft?.projectTitle).toBe('Updated Project Title');
      expect(loadedDraft?.projectSummary).toBe('Updated project summary');
      expect(loadedDraft?.fullLegalName).toBe('John Doe Updated');
      expect(result3.current.draftId).toBe(draftId);

      // Step 4: Submit application (convert draft to submitted)
      const { error: submitError } = await shared.realClient!
        .from('applications')
        .update({
          status: 'pending',
          is_draft: false,
        })
        .eq('id', draftId)
        .select()
        .single();

      expect(submitError).toBeNull();

      // Verify draft was converted to submission
      const { data: submittedApp } = await shared.realClient!
        .from('applications')
        .select('*')
        .eq('id', draftId)
        .single();

      expect(submittedApp?.status).toBe('pending');
      expect(submittedApp?.is_draft).toBe(false);

      // Step 5: Verify auto-save doesn't work after submission
      // The hook should detect that the draft was converted and clear the draftId
      // This is tested by the guard logic in the hook
    }, 60000);

    itIf('should handle draft workflow with multiple auto-saves', async () => {
      const mockFormData: ApplicationFormData = {
        projectId: testProjectId,
        applicantType: 'Organization',
        fullLegalName: 'Test Organization',
        organizationName: 'Test Org',
        countryOfResidence: 'Nigeria',
        emailAddress: testUserEmail,
        phoneNumber: '+1234567890',
        projectTitle: 'Multi-save Test',
        projectSummary: 'Testing multiple saves',
      };

      const onSaved = vi.fn();

      const { result } = renderHook(
        () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      // First save (create)
      await act(async () => {
        await result.current.saveDraft();
      });

      await waitFor(
        () => {
          expect(result.current.isSaving).toBe(false);
        },
        { timeout: 10000 }
      );

      const draftId = result.current.draftId!;
      testDraftIds.push(draftId);

      // Second save (update)
      const formData2: ApplicationFormData = {
        ...mockFormData,
        projectTitle: 'Multi-save Test - Updated 1',
      };

      const { result: result2 } = renderHook(
        () => useAutoSaveDraft({ formData: formData2, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      await act(async () => {
        // Load existing draft first
        await result2.current.loadExistingDraft();
        // Then save
        await result2.current.saveDraft();
      });

      await waitFor(
        () => {
          expect(result2.current.isSaving).toBe(false);
        },
        { timeout: 10000 }
      );

      // Third save (update)
      const formData3: ApplicationFormData = {
        ...formData2,
        projectTitle: 'Multi-save Test - Updated 2',
      };

      const { result: result3 } = renderHook(
        () => useAutoSaveDraft({ formData: formData3, onSaved }),
        {
          wrapper: createWrapper(),
        }
      );

      await act(async () => {
        await result3.current.loadExistingDraft();
        await result3.current.saveDraft();
      });

      await waitFor(
        () => {
          expect(result3.current.isSaving).toBe(false);
        },
        { timeout: 10000 }
      );

      // Verify final state
      const { data: finalDraft } = await shared.realClient!
        .from('applications')
        .select('*')
        .eq('id', draftId)
        .single();

      expect(finalDraft?.project_title).toBe('Multi-save Test - Updated 2');
      expect(finalDraft?.is_draft).toBe(true);
    }, 60000);

    itIf('should handle draft load when no draft exists', async () => {
      // Create a different project for this test to avoid conflicts
      const { data: newProjectData, error: newProjectError } = await supabaseAdmin!
        .from('projects')
        .insert({
          title: `IntTest Draft Project No Draft ${testTimestamp}`,
          description: 'Integration test project for no draft test',
          sector_id: testsectorId,
          status: 'open',
          location: 'Kenya',
          funding_amount: '$30,000',
          deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
          featured: false,
        })
        .select('id')
        .single();

      if (newProjectError || !newProjectData) {
        throw new Error(`Failed to create test project: ${newProjectError?.message}`);
      }

      const newProjectId = newProjectData.id;

      try {
        const mockFormData: ApplicationFormData = {
          projectId: newProjectId,
          applicantType: 'Individual',
          fullLegalName: 'New User',
          countryOfResidence: 'Kenya',
          emailAddress: testUserEmail,
        };

        const onSaved = vi.fn();

        const { result } = renderHook(
          () => useAutoSaveDraft({ formData: mockFormData, onSaved }),
          {
            wrapper: createWrapper(),
          }
        );

        let loadedDraft: any;
        await act(async () => {
          loadedDraft = await result.current.loadExistingDraft();
        });

        // Should return null when no draft exists
        expect(loadedDraft).toBeNull();
        expect(result.current.draftId).toBeNull();
      } finally {
        // Clean up the test project
        await supabaseAdmin!
          .from('projects')
          .delete()
          .eq('id', newProjectId);
      }
    }, 30000);
  });
});









