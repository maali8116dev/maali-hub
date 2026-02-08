import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitReview, useApplicationReviewScores } from '../useReviewerAssignment';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

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

describe('useSubmitReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully submit review scores', async () => {
    const mockReviewScore = {
      id: 'score-1',
      application_id: 'app-123',
      reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789',
      scores: { innovation: 8, feasibility: 7, impact: 9 },
      overall_score: 8.0,
      comments: 'Strong proposal',
      recommendation: 'approve' as const,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockReviewScore,
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') {
        return {
          upsert: mockUpsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === 'application_assignments') {
        return {
          update: mockUpdate,
          eq: mockEq,
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIdle).toBe(true);
    });

    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 8, feasibility: 7, impact: 9 },
      comments: 'Strong proposal',
      recommendation: 'approve',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: 'app-123',
        reviewer_id: 'reviewer-456',
        assignment_id: 'assignment-789',
        scores: { innovation: 8, feasibility: 7, impact: 9 },
        recommendation: 'approve',
      }),
      { onConflict: 'application_id,reviewer_id' }
    );

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' });
    expect(mockEq).toHaveBeenCalledWith('id', 'assignment-789');
  });

  it('should handle upsert (updating existing review)', async () => {
    const mockReviewScore = {
      id: 'score-1',
      application_id: 'app-123',
      reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789',
      scores: { innovation: 9, feasibility: 8, impact: 9 },
      overall_score: 8.67,
      comments: 'Updated review',
      recommendation: 'approve' as const,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockReviewScore,
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') {
        return {
          upsert: mockUpsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === 'application_assignments') {
        return {
          update: mockUpdate,
          eq: mockEq,
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 9, feasibility: 8, impact: 9 },
      comments: 'Updated review',
      recommendation: 'approve',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpsert).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockReviewScore);
  });

  it('should handle errors when submitting review', async () => {
    const mockError = { message: 'Database error', code: 'PGRST116' };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      upsert: mockUpsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 8 },
      recommendation: 'approve',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should handle null comments', async () => {
    const mockReviewScore = {
      id: 'score-1',
      application_id: 'app-123',
      reviewer_id: 'reviewer-456',
      assignment_id: 'assignment-789',
      scores: { innovation: 8 },
      overall_score: 8.0,
      comments: null,
      recommendation: 'approve' as const,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockUpsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockReviewScore,
      error: null,
    });

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'review_scores') {
        return {
          upsert: mockUpsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === 'application_assignments') {
        return {
          update: mockUpdate,
          eq: mockEq,
        };
      }
      return {};
    });

    const { result } = renderHook(() => useSubmitReview(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      reviewerId: 'reviewer-456',
      assignmentId: 'assignment-789',
      scores: { innovation: 8 },
      recommendation: 'approve',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: null,
      }),
      expect.any(Object)
    );
  });

  it('should support all recommendation types', async () => {
    const recommendations: Array<'approve' | 'reject' | 'request_info'> = [
      'approve',
      'reject',
      'request_info',
    ];

    for (const recommendation of recommendations) {
      const mockReviewScore = {
        id: 'score-1',
        application_id: 'app-123',
        reviewer_id: 'reviewer-456',
        assignment_id: 'assignment-789',
        scores: { innovation: 8 },
        overall_score: 8.0,
        comments: 'Test',
        recommendation,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockUpsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockReviewScore,
        error: null,
      });

      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'review_scores') {
          return {
            upsert: mockUpsert,
            select: mockSelect,
            single: mockSingle,
          };
        }
        if (table === 'application_assignments') {
          return {
            update: mockUpdate,
            eq: mockEq,
          };
        }
        return {};
      });

      const { result } = renderHook(() => useSubmitReview(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        applicationId: 'app-123',
        reviewerId: 'reviewer-456',
        assignmentId: 'assignment-789',
        scores: { innovation: 8 },
        recommendation,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          recommendation,
        }),
        expect.any(Object)
      );

      vi.clearAllMocks();
    }
  });
});

describe('useApplicationReviewScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch review scores for an application', async () => {
    const mockRpcData = [
      {
        id: 'score-1',
        application_id: 'app-123',
        reviewer_id: 'reviewer-456',
        assignment_id: 'assignment-789',
        scores: { innovation: 8, feasibility: 7 },
        overall_score: 7.5,
        comments: 'Good proposal',
        recommendation: 'approve',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reviewer_user_id: 'reviewer-456',
        reviewer_first_name: 'John',
        reviewer_last_name: 'Doe',
      },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].application_id).toBe('app-123');
    expect(result.current.data?.[0].reviewer_id).toBe('reviewer-456');
    expect(result.current.data?.[0].scores).toEqual({ innovation: 8, feasibility: 7 });
    expect(result.current.data?.[0].recommendation).toBe('approve');
    expect(result.current.data?.[0].reviewer).toEqual({
      user_id: 'reviewer-456',
      first_name: 'John',
      last_name: 'Doe',
    });
  });

  it('should return empty array when no scores exist', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should not fetch when applicationId is empty', () => {
    const { result } = renderHook(() => useApplicationReviewScores(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const mockError = { message: 'RPC error', code: 'PGRST301' };

    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });

  it('should handle scores without reviewer profile', async () => {
    const mockRpcData = [
      {
        id: 'score-1',
        application_id: 'app-123',
        reviewer_id: 'reviewer-456',
        assignment_id: 'assignment-789',
        scores: { innovation: 8 },
        overall_score: 8.0,
        comments: null,
        recommendation: 'approve',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reviewer_user_id: null,
        reviewer_first_name: null,
        reviewer_last_name: null,
      },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useApplicationReviewScores('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].reviewer).toBeUndefined();
  });
});

