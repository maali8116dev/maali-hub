/**
 * Integration tests -” useReviewAggregation hook hits the REAL database.
 *
 * Simulates: Admin opens review summary for an application that has
 * completed reviews â†’ sees aggregated scores, averages, recommendations.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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

import { useReviewAggregation, useApplicationReviewScores, calculateDecision } from '../useReviewerAssignment';

describe('useReviewAggregation -” real user flow', () => {
  let adminUserId: string;
  let testApplicationId: string;
  let testProjectId: number;
  let testsectorId: number;
  let testReviewerIds: string[] = [];
  let testAssignmentIds: string[] = [];
  let testApplicantId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping.');
      return;
    }

    // Admin
    const adminEmail = `int-admin-agg-${Date.now()}@maali.test`;
    const { data: ad } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    adminUserId = ad!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: adminUserId, first_name: 'T', last_name: 'A', role: 'admin' },
      { onConflict: 'user_id' },
    );
    await getRealClient().auth.signInWithPassword({ email: adminEmail, password: 'TestPassword123!' });

    // sector
    let { data: catData } = await supabaseAdmin
      .from('sectors').select('id').eq('name', 'Technology').single();
    testsectorId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('projects').insert({
      title: `IntTest Agg ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: testsectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    testProjectId = pj!.id;

    // Applicant
    const aEmail = `int-app-agg-${Date.now()}@maali.test`;
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
      user_id: testApplicantId, project_id: testProjectId,
      contact_email: aEmail, company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    testApplicationId = app!.id;

    // 2 Reviewers with completed reviews
    for (let i = 0; i < 2; i++) {
      const rEmail = `int-rev-agg-${Date.now()}-${i}@maali.test`;
      const { data: ru } = await supabaseAdmin.auth.admin.createUser({
        email: rEmail, password: 'TestPassword123!', email_confirm: true,
      });
      if (!ru?.user) continue;
      testReviewerIds.push(ru.user.id);

      await supabaseAdmin.from('profiles').upsert(
        { user_id: ru.user.id, first_name: `Reviewer${i}`, last_name: 'Int', role: 'reviewer' },
        { onConflict: 'user_id' },
      );
      await supabaseAdmin.from('reviewer_sectors').insert({
        reviewer_id: ru.user.id, sector_id: testsectorId,
      });

      const { data: assignData } = await supabaseAdmin.from('application_assignments').insert({
        application_id: testApplicationId, reviewer_id: ru.user.id, status: 'completed',
      }).select('id').single();

      if (assignData) {
        testAssignmentIds.push(assignData.id);
        await supabaseAdmin.from('review_scores').insert({
          application_id: testApplicationId,
          reviewer_id: ru.user.id,
          assignment_id: assignData.id,
          scores: i === 0
            ? { innovation: 9, feasibility: 9, impact: 10 }
            : { innovation: 10, feasibility: 9, impact: 9 },
          overall_score: i === 0 ? 9.33 : 9.33,
          comments: i === 0 ? 'Excellent application' : 'Outstanding potential',
          recommendation: 'approve',
          submitted_at: new Date().toISOString(),
        });
      }
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationId) {
      await supabaseAdmin.from('review_scores').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testProjectId) await supabaseAdmin.from('projects').delete().eq('id', testProjectId);
    for (const rid of testReviewerIds) {
      await supabaseAdmin.from('reviewer_sectors').delete().eq('reviewer_id', rid);
    }
    for (const uid of [...testReviewerIds, testApplicantId, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await getRealClient().auth.signOut();
  }, 30000);

  it('admin views review summary â†’ sees aggregated scores from 2 reviewers', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    // Pre-populate the cache with assignments (the hook reads from cache)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(
      ['application-assignments', testApplicationId],
      testAssignmentIds.map((id, idx) => ({
        id,
        reviewer_id: testReviewerIds[idx],
      })),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useReviewAggregation(testApplicationId),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    const agg = result.current.data;
    expect(agg).not.toBeNull();
    expect(agg!.total_reviews).toBe(2);
    expect(agg!.pending_reviewers).toBe(0);
    expect(agg!.average_score).toBeGreaterThan(0);
    expect(agg!.recommendations.approve).toBe(2);
    expect(agg!.scores).toHaveLength(2);

    // Per-criterion averages should be calculated
    expect(agg!.per_criterion_averages.innovation).toBeCloseTo(9.5, 1);
    expect(agg!.per_criterion_averages.feasibility).toBeCloseTo(9.0, 1);
    expect(agg!.per_criterion_averages.impact).toBeCloseTo(9.5, 1);
  }, 20000);

  it('admin feeds aggregation into decision engine â†’ gets "approve"', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(
      ['application-assignments', testApplicationId],
      testAssignmentIds.map((id, idx) => ({
        id,
        reviewer_id: testReviewerIds[idx],
      })),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useReviewAggregation(testApplicationId),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    // Feed real aggregation into the decision engine
    const decision = calculateDecision(result.current.data!, 2);
    expect(decision).not.toBeNull();
    expect(decision!.recommendedDecision).toBe('approve');
    expect(decision!.confidence).toBeGreaterThan(0.5);
    expect(decision!.canAutoApprove).toBe(true);
  }, 20000);
});

describe('useApplicationReviewScores -” real user flow', () => {
  // Reuses the same DB state set up above, but we need our own setup
  // since each describe gets its own scope

  let adminUserId: string;
  let testApplicationId: string;
  let testProjectId: number;
  let testsectorId: number;
  let testReviewerIds: string[] = [];
  let testApplicantId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) return;

    const adminEmail = `int-admin-scores-${Date.now()}@maali.test`;
    const { data: ad } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
    });
    adminUserId = ad!.user!.id;
    await supabaseAdmin.from('profiles').upsert(
      { user_id: adminUserId, first_name: 'T', last_name: 'A', role: 'admin' },
      { onConflict: 'user_id' },
    );
    await getRealClient().auth.signInWithPassword({ email: adminEmail, password: 'TestPassword123!' });

    let { data: catData } = await supabaseAdmin.from('sectors').select('id').eq('name', 'Technology').single();
    testsectorId = catData?.id || 1;

    const { data: pj } = await supabaseAdmin.from('projects').insert({
      title: `IntTest Scores ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: testsectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    testProjectId = pj!.id;

    const aEmail = `int-app-scores-${Date.now()}@maali.test`;
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

    // One reviewer with a submitted score
    const rEmail = `int-rev-scores-${Date.now()}@maali.test`;
    const { data: ru } = await supabaseAdmin.auth.admin.createUser({
      email: rEmail, password: 'TestPassword123!', email_confirm: true,
    });
    testReviewerIds.push(ru!.user!.id);
    await supabaseAdmin.from('profiles').upsert(
      { user_id: ru!.user!.id, first_name: 'ReviewerScore', last_name: 'T', role: 'reviewer' },
      { onConflict: 'user_id' },
    );
    const { data: assignData } = await supabaseAdmin.from('application_assignments').insert({
      application_id: testApplicationId, reviewer_id: ru!.user!.id, status: 'completed',
    }).select('id').single();
    await supabaseAdmin.from('review_scores').insert({
      application_id: testApplicationId, reviewer_id: ru!.user!.id,
      assignment_id: assignData!.id,
      scores: { innovation: 7, feasibility: 8 }, overall_score: 7.5,
      comments: 'Decent proposal', recommendation: 'approve',
      submitted_at: new Date().toISOString(),
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
    for (const uid of [...testReviewerIds, testApplicantId, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await getRealClient().auth.signOut();
  }, 30000);

  it('admin views individual review scores â†’ sees reviewer names + scores', async () => {
    if (!supabaseAdmin) return;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useApplicationReviewScores(testApplicationId),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.length).toBe(1);

    const score = result.current.data![0];
    expect(score.application_id).toBe(testApplicationId);
    expect(score.reviewer_id).toBeDefined();
    expect(score.reviewer_id).toBeTruthy();
    expect(score.scores).toEqual({ innovation: 7, feasibility: 8 });
    expect(score.recommendation).toBe('approve');
  }, 20000);
});









