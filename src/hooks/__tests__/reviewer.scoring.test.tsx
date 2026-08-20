import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { useSaveReviewDraft, useSubmitReview, useApplicationReviewScores } from '../useReviewerAssignment';
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

const buildProfileQuery = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { first_name: 'Jane', last_name: 'Reviewer', role: 'reviewer' },
    error: null,
  }),
});

const buildApplicationQuery = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { opportunity_id: 1, projects: { title: 'Test Opportunity' } },
    error: null,
  }),
});

// ============================================================
// Hook-level tests (mocked Supabase client)
// ============================================================

describe('useSubmitReview (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should handle upsert (updating existing review)', async () => {
    const mockReviewScore = {
      id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789', scores: { innovation: 9, feasibility: 8, impact: 9 },
      overall_score: 8.67, comments: 'Updated review', recommendation: 'approve' as const,
      submitted_at: new Date().toISOString(), created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockReviewScore, error: null });
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') return { upsert: mockUpsert, select: mockSelect, single: mockSingle };
      if (table === 'application_assignments') return { update: mockUpdate, eq: mockEq };
      if (table === 'profiles') return buildProfileQuery();
      if (table === 'applications') return buildApplicationQuery();
      return {};
    });

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() });
    result.current.mutate({
      applicationId: 'app-123', reviewerId: 'reviewer-456', assignmentId: 'assignment-789',
      scores: { innovation: 9, feasibility: 8, impact: 9 }, comments: 'Updated review',
      recommendation: 'approve',
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(mockUpsert).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockReviewScore);
  });

  it('should handle errors when submitting review', async () => {
    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error', code: 'PGRST116' } });

    (supabase.from as any).mockReturnValue({ upsert: mockUpsert, select: mockSelect, single: mockSingle });

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() });
    result.current.mutate({
      applicationId: 'app-123', reviewerId: 'reviewer-456', assignmentId: 'assignment-789',
      scores: { innovation: 8 }, recommendation: 'approve',
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error).toBeDefined();
  });

  it('should handle null comments', async () => {
    const mockReviewScore = {
      id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789', scores: { innovation: 8 }, overall_score: 8.0,
      comments: null, recommendation: 'approve' as const,
      submitted_at: new Date().toISOString(), created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockReviewScore, error: null });
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') return { upsert: mockUpsert, select: mockSelect, single: mockSingle };
      if (table === 'application_assignments') return { update: mockUpdate, eq: mockEq };
      if (table === 'profiles') return buildProfileQuery();
      if (table === 'applications') return buildApplicationQuery();
      return {};
    });

    const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() });
    result.current.mutate({
      applicationId: 'app-123', reviewerId: 'reviewer-456', assignmentId: 'assignment-789',
      scores: { innovation: 8 }, recommendation: 'approve',
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ comments: null }), expect.any(Object));
  });

  it('should support all recommendation types', async () => {
    const recommendations: Array<'approve' | 'reject' | 'request_info'> = ['approve', 'reject', 'request_info'];

    for (const recommendation of recommendations) {
      const mockUpsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'score-1', recommendation, scores: { innovation: 8 }, overall_score: 8.0 },
        error: null,
      });
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'review_scores') return { upsert: mockUpsert, select: mockSelect, single: mockSingle };
        if (table === 'application_assignments') return { update: mockUpdate, eq: mockEq };
        if (table === 'profiles') return buildProfileQuery();
        if (table === 'applications') return buildApplicationQuery();
        return {};
      });

      const { result } = renderHook(() => useSubmitReview(), { wrapper: createWrapper() });
      result.current.mutate({
        applicationId: 'app-123', reviewerId: 'reviewer-456', assignmentId: 'assignment-789',
        scores: { innovation: 8 }, recommendation,
      });

      await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ recommendation }), expect.any(Object));
      vi.clearAllMocks();
    }
  });
});

describe('useSaveReviewDraft (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should save draft with submitted_at null and mark assignment in_progress', async () => {
    const mockDraft = {
      id: 'score-1',
      application_id: 'app-123',
      reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789',
      scores: { innovation: 7, feasibility: 6 },
      comments: 'Draft notes',
      recommendation: 'request_info' as const,
      submitted_at: null,
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockDraft, error: null });
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') return { upsert: mockUpsert, select: mockSelect, single: mockSingle };
      if (table === 'application_assignments') return { update: mockUpdate, eq: mockEq };
      return {};
    });

    const { result } = renderHook(() => useSaveReviewDraft(), { wrapper: createWrapper() });
    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 7, feasibility: 6 },
      comments: 'Draft notes',
      recommendation: 'request_info',
    });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submitted_at: null,
        recommendation: 'request_info',
      }),
      expect.any(Object)
    );
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'in_progress' });
  });

  it('should handle draft save errors', async () => {
    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Save failed', code: 'PGRST116' } });

    (supabase.from as any).mockReturnValue({ upsert: mockUpsert, select: mockSelect, single: mockSingle });

    const { result } = renderHook(() => useSaveReviewDraft(), { wrapper: createWrapper() });
    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 8 },
      recommendation: 'approve',
    });

    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error).toBeDefined();
  });
});

describe('useApplicationReviewScores (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should fetch review scores for an application', async () => {
    const mockRpcData = [{
      id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789', scores: { innovation: 8, feasibility: 7 },
      overall_score: 7.5, comments: 'Good proposal', recommendation: 'approve',
      submitted_at: new Date().toISOString(), created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), reviewer_user_id: 'reviewer-456',
      reviewer_first_name: 'John', reviewer_last_name: 'Doe',
    }];

    (supabase.rpc as any).mockResolvedValue({ data: mockRpcData, error: null });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].scores).toEqual({ innovation: 8, feasibility: 7 });
    expect(result.current.data?.[0].reviewer_id).toBe('reviewer-456');
  });

  it('should return empty array when no scores exist', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useApplicationReviewScores('app-123'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toEqual([]);
  });

  it('should not fetch when applicationId is empty', () => {
    const { result } = renderHook(() => useApplicationReviewScores(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: null, error: { message: 'RPC error', code: 'PGRST301' } });
    const { result } = renderHook(() => useApplicationReviewScores('app-123'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isError).toBe(true); }, { timeout: 3000 });
    expect(result.current.error).toBeDefined();
  });

  it('should handle scores without reviewer profile', async () => {
    const mockRpcData = [{
      id: 'score-1', application_id: 'app-123', reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789', scores: { innovation: 8 }, overall_score: 8.0,
      comments: null, recommendation: 'approve',
      submitted_at: new Date().toISOString(), created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(), reviewer_user_id: null,
      reviewer_first_name: null, reviewer_last_name: null,
    }];
    (supabase.rpc as any).mockResolvedValue({ data: mockRpcData, error: null });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.[0].reviewer_id).toBe('reviewer-456');
  });
});

// ============================================================
// Direct DB integration tests (real database)
// ============================================================

describe.skip('Review scoring (Integration)', () => {
  let testApplicationId: string;
  let testProjectId: number;
  let testsectorId: number;
  let testReviewerId: string;
  let testAssignmentId: string;
  let testApplicantId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping integration tests.');
      return;
    }

    // sector
    let { data: catData } = await supabaseAdmin.from('sectors').select('id').eq('name', 'Technology').single();
    testsectorId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('opportunities').insert({
      title: `Test Score Project ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: testsectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    if (!pj) throw new Error('Failed to create project');
    testProjectId = pj.id;

    // Applicant
    const aEmail = `test-app-score-${Date.now()}@maali.test`;
    const { data: au } = await supabaseAdmin.auth.admin.createUser({ email: aEmail, password: 'TestPassword123!', email_confirm: true });
    if (!au?.user) throw new Error('Failed to create applicant');
    testApplicantId = au.user.id;
    await supabaseAdmin.from('profiles').upsert({ user_id: testApplicantId, first_name: 'T', last_name: 'A', role: 'applicant' }, { onConflict: 'user_id' });

    // Application
    const { data: app } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testApplicantId, opportunity_id: testProjectId, contact_email: aEmail,
      company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    if (!app) throw new Error('Failed to create application');
    testApplicationId = app.id;

    // Reviewer
    const rEmail = `test-rev-score-${Date.now()}@maali.test`;
    const { data: ru } = await supabaseAdmin.auth.admin.createUser({ email: rEmail, password: 'TestPassword123!', email_confirm: true });
    if (!ru?.user) throw new Error('Failed to create reviewer');
    testReviewerId = ru.user.id;
    await supabaseAdmin.from('profiles').upsert({ user_id: testReviewerId, first_name: 'T', last_name: 'R', role: 'reviewer' }, { onConflict: 'user_id' });
    await supabaseAdmin.from('reviewer_sectors').insert({ reviewer_id: testReviewerId, sector_id: testsectorId });

    // Assignment
    const { data: assignData } = await supabaseAdmin.from('application_assignments').insert({
      application_id: testApplicationId, reviewer_id: testReviewerId, status: 'in_progress',
    }).select('id').single();
    if (!assignData) throw new Error('Failed to create assignment');
    testAssignmentId = assignData.id;

    // Sign in as reviewer
    await integrationClient.auth.signInWithPassword({ email: rEmail, password: 'TestPassword123!' });
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationId) {
      await supabaseAdmin.from('review_scores').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testProjectId) await supabaseAdmin.from('opportunities').delete().eq('id', testProjectId);
    if (testReviewerId) await supabaseAdmin.from('reviewer_sectors').delete().eq('reviewer_id', testReviewerId);
    for (const uid of [testReviewerId, testApplicantId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await integrationClient.auth.signOut();
  }, 30000);

  it('should insert a review score and trigger overall_score calculation', async () => {
    if (!supabaseAdmin) return;

    // Clean up any existing scores for this reviewer
    await supabaseAdmin.from('review_scores').delete()
      .eq('application_id', testApplicationId).eq('reviewer_id', testReviewerId);

    const { data, error } = await integrationClient.from('review_scores').upsert({
      application_id: testApplicationId,
      reviewer_id: testReviewerId,
      assignment_id: testAssignmentId,
      scores: { innovation: 8, feasibility: 7, impact: 9 },
      comments: 'Strong proposal',
      recommendation: 'approve',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'application_id,reviewer_id' }).select().single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.application_id).toBe(testApplicationId);
    expect(data!.reviewer_id).toBe(testReviewerId);
    expect(data!.recommendation).toBe('approve');
    // overall_score should be set by the calculate_review_score trigger
    expect(data!.overall_score).toBeDefined();
    expect(data!.overall_score).toBeGreaterThan(0);
  });

  it('should upsert (update) an existing review score', async () => {
    if (!supabaseAdmin) return;

    const { data, error } = await integrationClient.from('review_scores').upsert({
      application_id: testApplicationId,
      reviewer_id: testReviewerId,
      assignment_id: testAssignmentId,
      scores: { innovation: 9, feasibility: 9, impact: 9 },
      comments: 'Updated: excellent proposal',
      recommendation: 'approve',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'application_id,reviewer_id' }).select().single();

    expect(error).toBeNull();
    expect(data!.comments).toBe('Updated: excellent proposal');
    expect(data!.scores).toEqual({ innovation: 9, feasibility: 9, impact: 9 });
  });
});








