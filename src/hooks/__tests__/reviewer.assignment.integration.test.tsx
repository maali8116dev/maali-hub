/**
 * Integration tests -” useAssignReviewers hook hits the REAL database.
 *
 * Simulates: Admin clicks "Assign Reviewers" on an application.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const shared = vi.hoisted(() => ({
  SUPABASE_URL: "https://alpudhhsmgtpmgpjfuqs.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ",
  realClient: null as SupabaseClient<any> | null,
}));

const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(shared.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

vi.mock('@/integrations/supabase/client', async () => {
  const { createClient: cc } = await import('@supabase/supabase-js');
  shared.realClient = cc(shared.SUPABASE_URL, shared.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase: shared.realClient };
});

const getRealClient = () => shared.realClient!;

import { useAssignReviewers } from '../useReviewerAssignment';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAssignReviewers -” real user flow', () => {
  let adminUserId: string;
  let testApplicationId: string;
  let testProjectId: number;
  let testsectorId: number;
  let testReviewerIds: string[] = [];
  let testApplicantId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping.');
      return;
    }

    // Admin user
    const adminEmail = `int-admin-assign-${Date.now()}@maali.test`;
    const { data: ad } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    adminUserId = ad!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: adminUserId, first_name: 'T', last_name: 'A', role: 'admin' },
      { onConflict: 'user_id' },
    );

    // Sign in as admin
    await getRealClient().auth.signInWithPassword({
      email: adminEmail, password: 'TestPassword123!',
    });

    // sector
    let { data: catData } = await supabaseAdmin
      .from('sectors').select('id').eq('name', 'Technology').single();
    testsectorId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('opportunities').insert({
      title: `IntTest Assign ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: testsectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    testProjectId = pj!.id;

    // Applicant
    const aEmail = `int-app-assign-${Date.now()}@maali.test`;
    const { data: au } = await supabaseAdmin.auth.admin.createUser({
      email: aEmail, password: 'TestPassword123!', email_confirm: true,
    });
    testApplicantId = au!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: testApplicantId, first_name: 'T', last_name: 'A', role: 'applicant' },
      { onConflict: 'user_id' },
    );

    // Application
    const { data: app } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testApplicantId, opportunity_id: testProjectId,
      contact_email: aEmail, company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    testApplicationId = app!.id;

    // Create 3 reviewers for Technology
    for (let i = 0; i < 3; i++) {
      const rEmail = `int-rev-assign-${Date.now()}-${i}@maali.test`;
      const { data: ru } = await supabaseAdmin.auth.admin.createUser({
        email: rEmail, password: 'TestPassword123!', email_confirm: true,
      });
      if (!ru?.user) continue;
      testReviewerIds.push(ru.user.id);
      await supabaseAdmin.from('profiles').upsert(
        { user_id: ru.user.id, first_name: `Rev${i}`, last_name: 'T', role: 'reviewer' },
        { onConflict: 'user_id' },
      );
      await supabaseAdmin.from('reviewer_sectors').insert({
        reviewer_id: ru.user.id, sector_id: testsectorId,
      });
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationId) {
      await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testProjectId) await supabaseAdmin.from('opportunities').delete().eq('id', testProjectId);
    for (const rid of testReviewerIds) {
      await supabaseAdmin.from('reviewer_sectors').delete().eq('reviewer_id', rid);
    }
    for (const uid of [...testReviewerIds, testApplicantId, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await getRealClient().auth.signOut();
  }, 30000);

  beforeEach(async () => {
    if (!supabaseAdmin || !testApplicationId) return;
    await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
  });

  it('admin clicks "Assign Reviewers" â†’ 2 reviewers are assigned', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ applicationId: testApplicationId, numReviewers: 2 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    // Hook returns assignment data
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(2);
    expect(result.current.data![0]).toHaveProperty('reviewer_id');
    expect(result.current.data![0]).toHaveProperty('assignment_id');

    // Verify in the database
    const { data: dbAssignments } = await supabaseAdmin
      .from('application_assignments')
      .select('*')
      .eq('application_id', testApplicationId);
    expect(dbAssignments!.length).toBe(2);
  }, 20000);

  it('admin tries to assign again â†’ error (already assigned)', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    // First assignment succeeds
    const { result: r1 } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });
    r1.current.mutate({ applicationId: testApplicationId, numReviewers: 2 });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true), { timeout: 15000 });

    // Second attempt â†’ error
    const { result: r2 } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });
    r2.current.mutate({ applicationId: testApplicationId, numReviewers: 2 });
    await waitFor(() => expect(r2.current.isError).toBe(true), { timeout: 15000 });

    expect(r2.current.error?.message).toContain('already assigned');
  }, 30000);

  it('admin requests 999 reviewers â†’ error (not enough)', async () => {
    if (!supabaseAdmin) return;

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ applicationId: testApplicationId, numReviewers: 999 });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 15000 });

    expect(result.current.error?.message).toContain('Not enough available reviewers');
  }, 20000);
});









