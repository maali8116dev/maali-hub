import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { useReviewAggregation, useDecisionEngine, calculateDecision, ReviewAggregation } from '../useReviewerAssignment';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client for hook-level tests
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// --- Real clients for direct RPC integration tests ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const integrationClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

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

// ============================================================
// Hook-level tests (mocked Supabase client)
// ============================================================

describe('useReviewAggregation (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate variance correctly with 2+ reviews', async () => {
    const mockRpcData = [
      {
        id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-1',
        assignment_id: 'assignment-1', scores: { innovation: 5 }, overall_score: 5.0,
        recommendation: 'reject', submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        reviewer_user_id: 'reviewer-1', reviewer_first_name: 'John', reviewer_last_name: 'Doe',
      },
      {
        id: 'score-2', application_id: 'app-123', reviewer_id: 'reviewer-2',
        assignment_id: 'assignment-2', scores: { innovation: 9 }, overall_score: 9.0,
        recommendation: 'approve', submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        reviewer_user_id: 'reviewer-2', reviewer_first_name: 'Jane', reviewer_last_name: 'Smith',
      },
    ];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(['application-assignments', 'app-123'], [
      { id: 'assignment-1', reviewer_id: 'reviewer-1' },
      { id: 'assignment-2', reviewer_id: 'reviewer-2' },
    ]);

    (supabase.rpc as any).mockResolvedValue({ data: mockRpcData, error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReviewAggregation('app-123'), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    const agg = result.current.data;
    expect(agg).not.toBeNull();
    expect(agg?.score_variance).not.toBeNull();
    expect(agg?.score_variance).toBeGreaterThan(2);
  });

  it('should return null variance with single review', async () => {
    const mockRpcData = [{
      id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-1',
      assignment_id: 'assignment-1', scores: { innovation: 8 }, overall_score: 8.0,
      recommendation: 'approve', submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      reviewer_user_id: 'reviewer-1', reviewer_first_name: 'John', reviewer_last_name: 'Doe',
    }];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(['application-assignments', 'app-123'], [
      { id: 'assignment-1', reviewer_id: 'reviewer-1' },
    ]);
    (supabase.rpc as any).mockResolvedValue({ data: mockRpcData, error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReviewAggregation('app-123'), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.score_variance).toBeNull();
  });

  it('should track pending reviewers', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(['application-assignments', 'app-123'], [
      { id: 'assignment-1', reviewer_id: 'reviewer-1' },
      { id: 'assignment-2', reviewer_id: 'reviewer-2' },
    ]);
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReviewAggregation('app-123'), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data?.total_reviews).toBe(0);
    expect(result.current.data?.pending_reviewers).toBe(2);
    expect(result.current.data?.average_score).toBe(0);
  });

  it('should calculate per-criterion averages', async () => {
    const mockRpcData = [
      {
        id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-1',
        assignment_id: 'assignment-1', scores: { innovation: 8, feasibility: 7, impact: 9 },
        overall_score: 8.0, recommendation: 'approve', submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        reviewer_user_id: 'reviewer-1', reviewer_first_name: 'John', reviewer_last_name: 'Doe',
      },
      {
        id: 'score-2', application_id: 'app-123', reviewer_id: 'reviewer-2',
        assignment_id: 'assignment-2', scores: { innovation: 9, feasibility: 8, impact: 8 },
        overall_score: 8.33, recommendation: 'approve', submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        reviewer_user_id: 'reviewer-2', reviewer_first_name: 'Jane', reviewer_last_name: 'Smith',
      },
    ];

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    queryClient.setQueryData(['application-assignments', 'app-123'], [
      { id: 'assignment-1', reviewer_id: 'reviewer-1' },
      { id: 'assignment-2', reviewer_id: 'reviewer-2' },
    ]);
    (supabase.rpc as any).mockResolvedValue({ data: mockRpcData, error: null });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useReviewAggregation('app-123'), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data?.per_criterion_averages.innovation).toBeCloseTo(8.5, 1);
    expect(result.current.data?.per_criterion_averages.feasibility).toBeCloseTo(7.5, 1);
    expect(result.current.data?.per_criterion_averages.impact).toBeCloseTo(8.5, 1);
  });

  it('should return null when no applicationId provided', () => {
    const { result } = renderHook(() => useReviewAggregation(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

// ============================================================
// Pure function tests (no DB needed)
// ============================================================

describe('calculateDecision', () => {
  it('should recommend approve for high scores with low variance', () => {
    const aggregation: ReviewAggregation = {
      total_reviews: 2, pending_reviewers: 0, average_score: 8.5, score_variance: 0.5,
      per_criterion_averages: { innovation: 8.5 }, per_criterion_variances: {},
      recommendations: { approve: 2, reject: 0, request_info: 0 }, scores: [],
    };
    const result = calculateDecision(aggregation, 2);
    expect(result?.recommendedDecision).toBe('approve');
    expect(result?.confidence).toBeGreaterThan(0.7);
    expect(result?.canAutoApprove).toBe(true);
  });

  it('should recommend reject for low scores', () => {
    const aggregation: ReviewAggregation = {
      total_reviews: 2, pending_reviewers: 0, average_score: 4.0, score_variance: 0.5,
      per_criterion_averages: { innovation: 4.0 }, per_criterion_variances: {},
      recommendations: { approve: 0, reject: 2, request_info: 0 }, scores: [],
    };
    const result = calculateDecision(aggregation, 2);
    expect(result?.recommendedDecision).toBe('reject');
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it('should recommend request_info for high variance', () => {
    const aggregation: ReviewAggregation = {
      total_reviews: 2, pending_reviewers: 0, average_score: 7.0, score_variance: 3.0,
      per_criterion_averages: { innovation: 7.0 }, per_criterion_variances: {},
      recommendations: { approve: 1, reject: 1, request_info: 0 }, scores: [],
    };
    const result = calculateDecision(aggregation, 2);
    expect(result?.recommendedDecision).toBe('request_info');
    expect(result?.reasoning.some(r => r.includes('High variance'))).toBe(true);
  });

  it('should recommend request_info for medium scores', () => {
    const aggregation: ReviewAggregation = {
      total_reviews: 2, pending_reviewers: 0, average_score: 6.5, score_variance: 1.0,
      per_criterion_averages: { innovation: 6.5 }, per_criterion_variances: {},
      recommendations: { approve: 0, reject: 0, request_info: 2 }, scores: [],
    };
    const result = calculateDecision(aggregation, 2);
    expect(result?.recommendedDecision).toBe('request_info');
  });

  it('should adjust confidence based on consensus', () => {
    const highConsensus: ReviewAggregation = {
      total_reviews: 3, pending_reviewers: 0, average_score: 8.0, score_variance: 0.3,
      per_criterion_averages: { innovation: 8.0 }, per_criterion_variances: {},
      recommendations: { approve: 3, reject: 0, request_info: 0 }, scores: [],
    };
    const lowConsensus: ReviewAggregation = {
      total_reviews: 3, pending_reviewers: 0, average_score: 8.0, score_variance: 0.3,
      per_criterion_averages: { innovation: 8.0 }, per_criterion_variances: {},
      recommendations: { approve: 1, reject: 1, request_info: 1 }, scores: [],
    };
    expect(calculateDecision(highConsensus, 3)?.confidence)
      .toBeGreaterThan(calculateDecision(lowConsensus, 3)?.confidence || 0);
  });
});

describe('useDecisionEngine (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return decision based on aggregation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDecisionEngine('app-123', 2), { wrapper });
    expect(result.current).toBeDefined();
  });
});

// ============================================================
// Direct RPC integration tests (real database)
// ============================================================

describe.skip('get_application_review_scores_with_reviewers RPC (Integration)', () => {
  let testApplicationId: string;
  let testProjectId: number;
  let testCategoryId: number;
  let testReviewerIds: string[] = [];
  let testAssignmentIds: string[] = [];
  let testApplicantId: string;
  let adminUserId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set — skipping integration tests.');
      return;
    }

    // Admin user
    const adminEmail = `test-admin-agg-${Date.now()}@maali.test`;
    const { data: ad } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    adminUserId = ad!.user!.id;
    await supabaseAdmin.from('profiles').upsert({
      user_id: adminUserId, first_name: 'T', last_name: 'A', role: 'admin',
    }, { onConflict: 'user_id' });
    await integrationClient.auth.signInWithPassword({ email: adminEmail, password: 'TestPassword123!' });

    // Category
    let { data: catData } = await supabaseAdmin.from('categories').select('id').eq('name', 'Technology').single();
    testCategoryId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('projects').insert({
      title: `Test Agg Project ${Date.now()}`, description: 'Test', status: 'open',
      category_id: testCategoryId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    if (!pj) throw new Error('Failed to create project');
    testProjectId = pj.id;

    // Applicant
    const aEmail = `test-app-agg-${Date.now()}@maali.test`;
    const { data: au } = await supabaseAdmin.auth.admin.createUser({ email: aEmail, password: 'TestPassword123!', email_confirm: true });
    testApplicantId = au!.user!.id;
    await supabaseAdmin.from('profiles').upsert({ user_id: testApplicantId, first_name: 'T', last_name: 'A', role: 'applicant' }, { onConflict: 'user_id' });

    // Application
    const { data: app } = await supabaseAdmin.from('applications').insert({
      user_id: testApplicantId, project_id: testProjectId, contact_email: aEmail,
      company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    if (!app) throw new Error('Failed to create application');
    testApplicationId = app.id;

    // Reviewers + assignments + scores
    for (let i = 0; i < 2; i++) {
      const rEmail = `test-rev-agg-${Date.now()}-${i}@maali.test`;
      const { data: ru } = await supabaseAdmin.auth.admin.createUser({ email: rEmail, password: 'TestPassword123!', email_confirm: true });
      if (!ru?.user) continue;
      testReviewerIds.push(ru.user.id);

      await supabaseAdmin.from('profiles').upsert({
        user_id: ru.user.id, first_name: `Rev${i}`, last_name: 'T', role: 'reviewer',
      }, { onConflict: 'user_id' });
      await supabaseAdmin.from('reviewer_categories').insert({ reviewer_id: ru.user.id, category_id: testCategoryId });

      const { data: assignData } = await supabaseAdmin.from('application_assignments').insert({
        application_id: testApplicationId, reviewer_id: ru.user.id, status: 'completed',
      }).select('id').single();

      if (assignData) {
        testAssignmentIds.push(assignData.id);
        await supabaseAdmin.from('review_scores').insert({
          application_id: testApplicationId, reviewer_id: ru.user.id,
          assignment_id: assignData.id,
          scores: i === 0 ? { innovation: 8, feasibility: 7, impact: 9 } : { innovation: 9, feasibility: 8, impact: 8 },
          overall_score: i === 0 ? 8.0 : 8.33, comments: 'Test', recommendation: 'approve',
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
    for (const rid of testReviewerIds) await supabaseAdmin.from('reviewer_categories').delete().eq('reviewer_id', rid);
    for (const uid of [...testReviewerIds, testApplicantId, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await integrationClient.auth.signOut();
  }, 30000);

  it('should return review scores with reviewer info', async () => {
    if (!supabaseAdmin) return;

    const { data, error } = await integrationClient.rpc('get_application_review_scores_with_reviewers', {
      p_application_id: testApplicationId,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(2);

    const score = (data as any[])[0];
    expect(score).toHaveProperty('reviewer_first_name');
    expect(score).toHaveProperty('reviewer_last_name');
    expect(score).toHaveProperty('overall_score');
    expect(score).toHaveProperty('recommendation');
    expect(score).toHaveProperty('scores');
  });

  it('should return empty array for application with no reviews', async () => {
    if (!supabaseAdmin) return;

    // Create a new application with no reviews (use admin client to bypass RLS)
    const { data: app2, error: insertError } = await supabaseAdmin.from('applications').insert({
      user_id: testApplicantId, project_id: testProjectId,
      contact_email: 'noreview@test.com', status: 'pending', is_draft: false,
    }).select('id').single();

    if (insertError || !app2) {
      console.warn('⚠️  Could not create test application:', insertError?.message);
      return;
    }

    const { data, error } = await integrationClient.rpc('get_application_review_scores_with_reviewers', {
      p_application_id: app2.id,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(0);

    // cleanup
    await supabaseAdmin.from('applications').delete().eq('id', app2.id);
  });
});
