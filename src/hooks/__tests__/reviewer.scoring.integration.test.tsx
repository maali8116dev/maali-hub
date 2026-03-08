/**
 * Integration tests — useSubmitReview hook hits the REAL database.
 *
 * Simulates: Reviewer opens a review form, scores the application,
 * writes comments, picks a recommendation, and submits.
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

import { useSubmitReview } from '../useReviewerAssignment';

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

describe('useSubmitReview — real user flow', () => {
  let reviewerEmail: string;
  let testReviewerId: string;
  let testApplicationId: string;
  let testAssignmentId: string;
  let testProjectId: number;
  let testCategoryId: number;
  let testApplicantId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set — skipping.');
      return;
    }

    // Category
    let { data: catData } = await supabaseAdmin
      .from('categories').select('id').eq('name', 'Technology').single();
    testCategoryId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('projects').insert({
      title: `IntTest Score ${Date.now()}`, description: 'Test', status: 'open',
      category_id: testCategoryId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    testProjectId = pj!.id;

    // Applicant + Application
    const aEmail = `int-app-score-${Date.now()}@maali.test`;
    const { data: au } = await supabaseAdmin.auth.admin.createUser({
      email: aEmail, password: 'TestPassword123!', email_confirm: true,
    });
    testApplicantId = au!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: testApplicantId, first_name: 'T', last_name: 'A', role: 'applicant' },
      { onConflict: 'user_id' },
    );

    const { data: app } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testApplicantId, project_id: testProjectId,
      contact_email: aEmail, company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    testApplicationId = app!.id;

    // Reviewer
    reviewerEmail = `int-rev-score-${Date.now()}@maali.test`;
    const { data: ru } = await supabaseAdmin.auth.admin.createUser({
      email: reviewerEmail, password: 'TestPassword123!', email_confirm: true,
    });
    testReviewerId = ru!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: testReviewerId, first_name: 'Test', last_name: 'Reviewer', role: 'reviewer' },
      { onConflict: 'user_id' },
    );
    await supabaseAdmin.from('reviewer_categories').insert({
      reviewer_id: testReviewerId, category_id: testCategoryId,
    });

    // Assignment (status = in_progress, like it would be in the real flow)
    const { data: assignData } = await supabaseAdmin.from('application_assignments').insert({
      application_id: testApplicationId, reviewer_id: testReviewerId, status: 'in_progress',
    }).select('id').single();
    testAssignmentId = assignData!.id;

    // Sign in as the reviewer (this is the user performing the action)
    await getRealClient().auth.signInWithPassword({
      email: reviewerEmail, password: 'TestPassword123!',
    });
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationId) {
      await supabaseAdmin.from('review_scores').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testProjectId) await supabaseAdmin.from('projects').delete().eq('id', testProjectId);
    if (testReviewerId) {
      await supabaseAdmin.from('reviewer_categories').delete().eq('reviewer_id', testReviewerId);
    }
    for (const uid of [testReviewerId, testApplicantId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await getRealClient().auth.signOut();
  }, 30000);

  beforeEach(async () => {
    if (!supabaseAdmin) return;
    // Clean any previous scores so tests are independent
    await supabaseAdmin.from('review_scores').delete()
      .eq('application_id', testApplicationId)
      .eq('reviewer_id', testReviewerId);
    // Reset assignment status
    await supabaseAdmin.from('application_assignments')
      .update({ status: 'in_progress' })
      .eq('id', testAssignmentId);
  });

  it('reviewer submits a review → scores saved, assignment marked completed', async () => {
    if (!supabaseAdmin) return;

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: testApplicationId,
      reviewerId: testReviewerId,
      assignmentId: testAssignmentId,
      scores: { innovation: 8, feasibility: 7, impact: 9 },
      comments: 'Strong proposal with clear market potential',
      recommendation: 'approve',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    // Hook returns the saved review
    const saved = result.current.data;
    expect(saved).toBeDefined();
    expect(saved!.application_id).toBe(testApplicationId);
    expect(saved!.reviewer_id).toBe(testReviewerId);
    expect(saved!.scores).toEqual({ innovation: 8, feasibility: 7, impact: 9 });
    expect(saved!.recommendation).toBe('approve');
    expect(saved!.comments).toBe('Strong proposal with clear market potential');

    // overall_score is calculated by the database trigger
    expect(saved!.overall_score).toBeDefined();
    expect(saved!.overall_score).toBeGreaterThan(0);

    // Verify the assignment status was updated to 'completed' in the DB
    const { data: assignment } = await supabaseAdmin
      .from('application_assignments')
      .select('status')
      .eq('id', testAssignmentId)
      .single();
    expect(assignment!.status).toBe('completed');
  }, 20000);

  it('reviewer updates their review → upsert overwrites previous scores', async () => {
    if (!supabaseAdmin) return;

    // First submission
    const { result: r1 } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });
    r1.current.mutate({
      applicationId: testApplicationId,
      reviewerId: testReviewerId,
      assignmentId: testAssignmentId,
      scores: { innovation: 6, feasibility: 5 },
      comments: 'Initial review',
      recommendation: 'request_info',
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true), { timeout: 15000 });

    // Second submission (update)
    const { result: r2 } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });
    r2.current.mutate({
      applicationId: testApplicationId,
      reviewerId: testReviewerId,
      assignmentId: testAssignmentId,
      scores: { innovation: 9, feasibility: 9, impact: 9 },
      comments: 'Revised — much better after second look',
      recommendation: 'approve',
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true), { timeout: 15000 });

    // Verify only 1 row exists (upsert, not duplicate)
    const { data: rows } = await supabaseAdmin.from('review_scores')
      .select('*')
      .eq('application_id', testApplicationId)
      .eq('reviewer_id', testReviewerId);
    expect(rows!.length).toBe(1);
    expect(rows![0].recommendation).toBe('approve');
    expect(rows![0].comments).toBe('Revised — much better after second look');
  }, 30000);

  it('reviewer submits "reject" recommendation → saved correctly', async () => {
    if (!supabaseAdmin) return;

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: testApplicationId,
      reviewerId: testReviewerId,
      assignmentId: testAssignmentId,
      scores: { innovation: 3, feasibility: 2 },
      comments: 'Does not meet minimum criteria',
      recommendation: 'reject',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    expect(result.current.data!.recommendation).toBe('reject');

    // Verify in DB
    const { data: row } = await supabaseAdmin.from('review_scores')
      .select('recommendation')
      .eq('application_id', testApplicationId)
      .eq('reviewer_id', testReviewerId)
      .single();
    expect(row!.recommendation).toBe('reject');
  }, 20000);
});

