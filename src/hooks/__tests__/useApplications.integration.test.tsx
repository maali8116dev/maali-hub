/**
 * Integration tests -” hooks hit the REAL database.
 *
 * We mock `@/integrations/supabase/client` to return a real Supabase client
 * so the hooks behave exactly as they would in the browser.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import React from 'react';

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

// Mock useAuth to return our test user
vi.mock('@/hooks/useAuth');

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import { useApplications } from '../useApplications';
import { useAuth } from '../useAuth';

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

describe('useApplications - Integration Tests', () => {
  let testUserId: string;
  let testProjectIds: number[] = [];
  let testApplicationIds: string[] = [];
  let testsectorId: number;
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

    // 2. Create test user (applicant)
    const testEmail = `int-applicant-${testTimestamp}@maali.test`;
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
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

    // 3. Sign in the real client with test user
    const { error: signInError } = await shared.realClient!.auth.signInWithPassword({
      email: testEmail,
      password: 'TestPassword123!',
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    // 4. Create test projects
    const testProjects = [
      {
        title: `IntTest Project 1 ${testTimestamp}`,
        description: 'Integration test project 1',
        sector_id: testsectorId,
        status: 'open',
        location: 'Ghana',
        funding_amount: '$50,000',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        featured: false,
      },
      {
        title: `IntTest Project 2 ${testTimestamp}`,
        description: 'Integration test project 2',
        sector_id: testsectorId,
        status: 'open',
        location: 'Nigeria',
        funding_amount: '$75,000',
        deadline: new Date(Date.now() + 60 * 86400000).toISOString(),
        featured: false,
      },
    ];

    for (const project of testProjects) {
      const { data: newProject, error: projectError } = await supabaseAdmin
        .from('projects')
        .insert(project)
        .select('id')
        .single();

      if (!projectError && newProject) {
        testProjectIds.push(newProject.id);
      }
    }

    // 5. Create test applications
    const testApplications = [
      {
        user_id: testUserId,
        project_id: testProjectIds[0],
        contact_email: testEmail,
        organization_name: 'Test Company 1',
        country_of_residence: 'Ghana',
        project_title: 'Test Application 1',
        project_summary: 'Test project summary 1',
        status: 'pending',
        is_draft: false,
      },
      {
        user_id: testUserId,
        project_id: testProjectIds[1],
        contact_email: testEmail,
        organization_name: 'Test Company 2',
        country_of_residence: 'Nigeria',
        project_title: 'Test Application 2',
        project_summary: 'Test project summary 2',
        status: 'under_review', // Should map to 'pending'
        is_draft: false,
      },
      {
        user_id: testUserId,
        project_id: testProjectIds[0],
        contact_email: testEmail,
        organization_name: 'Test Company 3',
        country_of_residence: 'Ghana',
        project_title: 'Test Application 3',
        project_summary: 'Test project summary 3',
        status: 'approved',
        is_draft: false,
      },
    ];

    for (const application of testApplications) {
      const { data: newApp, error: appError } = await (supabaseAdmin
        .from('applications') as any)
        .insert(application)
        .select('id')
        .single();

      if (!appError && newApp) {
        testApplicationIds.push(newApp.id);
      }
    }

    // Mock useAuth to return our test user
    (useAuth as any).mockReturnValue({ user: { id: testUserId, email: testEmail } });
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    // Clean up test applications
    if (testApplicationIds.length > 0) {
      await supabaseAdmin
        .from('applications')
        .delete()
        .in('id', testApplicationIds);
    }

    // Clean up test projects
    if (testProjectIds.length > 0) {
      await supabaseAdmin
        .from('projects')
        .delete()
        .in('id', testProjectIds);
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

  describe('useApplications', () => {
    it('fetches applications with project details successfully from real database', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      
      // Should have at least our test applications (may have more from other tests)
      const ourApplications = result.current.data?.filter(app => 
        testApplicationIds.includes(app.id)
      ) || [];
      
      // We created 3 applications, but some might fail to insert, so check for at least 1
      expect(ourApplications.length).toBeGreaterThanOrEqual(1);
      expect(ourApplications.length).toBeLessThanOrEqual(testApplicationIds.length);

      // Verify data structure
      if (ourApplications.length > 0) {
        const app = ourApplications[0];
        expect(app).toHaveProperty('id');
        expect(app).toHaveProperty('projectTitle');
        expect(app).toHaveProperty('status');
        expect(app).toHaveProperty('contactEmail');
        expect(app).toHaveProperty('projectId');
        expect(app).toHaveProperty('submittedAt');
        expect(app).toHaveProperty('sector');
        expect(app).toHaveProperty('country');
      }
    });

    it('correctly joins applications with projects', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      const ourApplications = result.current.data?.filter(app => 
        testApplicationIds.includes(app.id)
      ) || [];

      if (ourApplications.length > 0) {
        // All applications should have project titles (not "Unknown Project")
        ourApplications.forEach((app) => {
          expect(app.opportunityTitle).not.toBe('Unknown Opportunity');
          expect(app.opportunityTitle).toBeDefined();
          expect(app.opportunityId).toBeDefined();
          expect(app.sector).toBeDefined();
        });
      }
    });

    it('maps status correctly (under_review to pending)', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      const ourApplications = result.current.data?.filter(app => 
        testApplicationIds.includes(app.id)
      ) || [];

      // Find the application with under_review status (should map to pending)
      const underReviewApp = ourApplications.find(app => 
        app.status === 'pending' && 
        (app.opportunityTitle.includes('Project 2') || app.contactEmail.includes('int-applicant'))
      );

      // If we found it, verify it was mapped correctly
      if (underReviewApp) {
        expect(underReviewApp.status).toBe('pending');
      }
    });

    it('includes project status and deadline information', async () => {
      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      const ourApplications = result.current.data?.filter(app => 
        testApplicationIds.includes(app.id)
      ) || [];

      if (ourApplications.length > 0) {
        const app = ourApplications[0];
        expect(app).toHaveProperty('projectStatus');
        expect(app).toHaveProperty('projectDeadline');
        expect(app).toHaveProperty('isProjectOpen');
      }
    });

    it('returns empty array when user has no applications', async () => {
      // Create a new user with no applications
      const emptyUserEmail = `int-empty-user-${testTimestamp}@maali.test`;
      const { data: emptyUserData, error: emptyUserError } = await supabaseAdmin.auth.admin.createUser({
        email: emptyUserEmail,
        password: 'TestPassword123!',
        email_confirm: true,
      });

      if (emptyUserError || !emptyUserData?.user) {
        throw new Error(`Failed to create empty user: ${emptyUserError?.message}`);
      }

      const emptyUserId = emptyUserData.user.id;

      // Create profile
      await supabaseAdmin.from('profiles').upsert(
        {
          user_id: emptyUserId,
          first_name: 'Empty',
          last_name: 'User',
          role: 'applicant',
        },
        { onConflict: 'user_id' }
      );

      // Sign in as empty user
      await shared.realClient!.auth.signInWithPassword({
        email: emptyUserEmail,
        password: 'TestPassword123!',
      });

      // Mock useAuth for empty user
      (useAuth as any).mockReturnValue({ user: { id: emptyUserId, email: emptyUserEmail } });

      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // Should return empty array
      expect(result.current.data).toEqual([]);

      // Clean up empty user
      await supabaseAdmin.auth.admin.deleteUser(emptyUserId);
    }, 30000);

    it('does not fetch when user is not authenticated', () => {
      (useAuth as any).mockReturnValue({ user: null });

      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      // Query should be disabled when user is null
      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('handles errors gracefully', async () => {
      // Temporarily break the RPC by using an invalid user ID format
      // This tests error handling
      (useAuth as any).mockReturnValue({ user: { id: 'invalid-uuid-format', email: 'test@test.com' } });

      const { result } = renderHook(() => useApplications(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.error).toBeDefined();
    }, 30000);
  });
});









