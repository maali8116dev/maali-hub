import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAssignReviewers,
  useApplicationAssignments,
  useReviewerAssignments,
  useReviewerWorkload,
  useCategoryRubric,
  useUpdateAssignmentStatus,
  useAddConflict,
  useReviewerCategories,
} from '../useReviewerAssignment';
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

describe('useAssignReviewers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully assign reviewers to application', async () => {
    const mockRpcData = [
      { reviewer_id: 'reviewer-1', assignment_id: 'assignment-1' },
      { reviewer_id: 'reviewer-2', assignment_id: 'assignment-2' },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isIdle).toBe(true);
    });

    result.current.mutate({
      applicationId: 'app-123',
      numReviewers: 2,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'assign_reviewers_to_application',
      {
        p_application_id: 'app-123',
        p_num_reviewers: 2,
      }
    );

    expect(result.current.data).toEqual(mockRpcData);
  });

  it('should use default numReviewers of 2', async () => {
    const mockRpcData = [
      { reviewer_id: 'reviewer-1', assignment_id: 'assignment-1' },
      { reviewer_id: 'reviewer-2', assignment_id: 'assignment-2' },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      // numReviewers not specified, should default to 2
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'assign_reviewers_to_application',
      {
        p_application_id: 'app-123',
        p_num_reviewers: 2,
      }
    );
  });

  it('should handle insufficient reviewers error', async () => {
    const mockError = {
      message: 'Not enough available reviewers for category. Need 2 reviewers, found 1',
      code: 'P0001',
    };

    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      numReviewers: 2,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should handle already assigned error', async () => {
    const mockError = {
      message: 'Reviewers already assigned to this application',
      code: 'P0001',
    };

    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      applicationId: 'app-123',
      numReviewers: 2,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('already assigned');
  });

  it('should invalidate queries on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const mockRpcData = [
      { reviewer_id: 'reviewer-1', assignment_id: 'assignment-1' },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAssignReviewers(), {
      wrapper,
    });

    result.current.mutate({
      applicationId: 'app-123',
      numReviewers: 1,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['application-assignments', 'app-123'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['reviewer-workload'],
    });
  });
});

describe('useApplicationAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch assignments for an application with reviewer profiles', async () => {
    const mockRpcData = [
      {
        id: 'assignment-1',
        application_id: 'app-123',
        reviewer_id: 'reviewer-1',
        assigned_at: '2024-01-01T00:00:00Z',
        status: 'pending',
        reviewer_user_id: 'reviewer-1',
        reviewer_first_name: 'John',
        reviewer_last_name: 'Doe',
      },
      {
        id: 'assignment-2',
        application_id: 'app-123',
        reviewer_id: 'reviewer-2',
        assigned_at: '2024-01-01T00:00:00Z',
        status: 'in_progress',
        reviewer_user_id: 'reviewer-2',
        reviewer_first_name: 'Jane',
        reviewer_last_name: 'Smith',
      },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useApplicationAssignments('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].application_id).toBe('app-123');
    expect(result.current.data?.[0].reviewer_id).toBe('reviewer-1');
    expect(result.current.data?.[0].status).toBe('pending');
    expect(result.current.data?.[0].reviewer).toEqual({
      user_id: 'reviewer-1',
      first_name: 'John',
      last_name: 'Doe',
    });
    expect(result.current.data?.[1].status).toBe('in_progress');
  });

  it('should return empty array when no assignments exist', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useApplicationAssignments('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should not fetch when applicationId is empty', () => {
    const { result } = renderHook(() => useApplicationAssignments(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle assignments without reviewer profile', async () => {
    const mockRpcData = [
      {
        id: 'assignment-1',
        application_id: 'app-123',
        reviewer_id: 'reviewer-1',
        assigned_at: '2024-01-01T00:00:00Z',
        status: 'pending',
        reviewer_user_id: null,
        reviewer_first_name: null,
        reviewer_last_name: null,
      },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useApplicationAssignments('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].reviewer).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    const mockError = { message: 'RPC error', code: 'PGRST301' };

    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useApplicationAssignments('app-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

describe('useReviewerAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch reviewer assignments', async () => {
    const mockRpcData = [
      {
        assignment_id: 'assignment-1',
        application_id: 'app-123',
        project_title: 'Test Project',
        status: 'pending',
      },
    ];

    (supabase.rpc as any).mockResolvedValue({
      data: mockRpcData,
      error: null,
    });

    const { result } = renderHook(() => useReviewerAssignments('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockRpcData);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_reviewer_assignments_with_application',
      { p_reviewer_id: 'reviewer-1' }
    );
  });

  it('should return empty array when reviewerId is not provided', () => {
    const { result } = renderHook(() => useReviewerAssignments(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should return empty array when reviewer has no assignments', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useReviewerAssignments('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    const mockError = { message: 'RPC error', code: 'PGRST301' };

    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: mockError,
    });

    const { result } = renderHook(() => useReviewerAssignments('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

describe('useReviewerWorkload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate reviewer workload correctly', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: 5,
      error: null,
    });

    const { result } = renderHook(() => useReviewerWorkload('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(5);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_reviewer_workload',
      { p_reviewer_id: 'reviewer-1' }
    );
  });

  it('should return 0 when reviewer has no workload', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: 0,
      error: null,
    });

    const { result } = renderHook(() => useReviewerWorkload('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(0);
  });

  it('should return 0 when reviewerId is not provided', () => {
    const { result } = renderHook(() => useReviewerWorkload(undefined), {
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

    const { result } = renderHook(() => useReviewerWorkload('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

describe('useCategoryRubric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch rubric for a category', async () => {
    const mockCategoryData = { id: 1 };
    const mockRubricData = {
      id: 'rubric-1',
      category_id: 1,
      rubric: {
        criteria: [
          { name: 'innovation', weight: 0.3, max_score: 10 },
          { name: 'feasibility', weight: 0.4, max_score: 10 },
        ],
      },
      categories: { name: 'Technology' },
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn();

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle.mockResolvedValueOnce({
            data: mockCategoryData,
            error: null,
          }),
        };
      }
      if (table === 'category_rubrics') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle.mockResolvedValueOnce({
            data: mockRubricData,
            error: null,
          }),
        };
      }
      return { select: mockSelect, eq: mockEq, single: mockSingle };
    });

    const { result } = renderHook(() => useCategoryRubric('Technology'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.category).toBe('Technology');
    expect(result.current.data?.rubric.criteria).toHaveLength(2);
  });

  it('should return null when category has no rubric', async () => {
    const mockCategoryData = { id: 1 };
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn();

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle.mockResolvedValueOnce({
            data: mockCategoryData,
            error: null,
          }),
        };
      }
      if (table === 'category_rubrics') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle.mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116', message: 'No rows returned' },
          }),
        };
      }
      return { select: mockSelect, eq: mockEq, single: mockSingle };
    });

    const { result } = renderHook(() => useCategoryRubric('Technology'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('should return null when category does not exist', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn();

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      }),
    });

    const { result } = renderHook(() => useCategoryRubric('NonExistent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('should not fetch when category is empty', () => {
    const { result } = renderHook(() => useCategoryRubric(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('useUpdateAssignmentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update assignment status successfully', async () => {
    const mockAssignment = {
      id: 'assignment-1',
      application_id: 'app-123',
      reviewer_id: 'reviewer-1',
      status: 'in_progress',
      assigned_at: '2024-01-01T00:00:00Z',
    };

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockAssignment,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useUpdateAssignmentStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      assignmentId: 'assignment-1',
      status: 'in_progress',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: 'in_progress' });
    expect(mockEq).toHaveBeenCalledWith('id', 'assignment-1');
  });

  it('should support all status values', async () => {
    const statuses: Array<'pending' | 'in_progress' | 'completed' | 'declined'> = [
      'pending',
      'in_progress',
      'completed',
      'declined',
    ];

    for (const status of statuses) {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'assignment-1', status, application_id: 'app-123' },
        error: null,
      });

      (supabase.from as any).mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
        select: mockSelect,
        single: mockSingle,
      });

      const { result } = renderHook(() => useUpdateAssignmentStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        assignmentId: 'assignment-1',
        status,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockUpdate).toHaveBeenCalledWith({ status });
      vi.clearAllMocks();
    }
  });

  it('should handle errors', async () => {
    const mockError = { message: 'Database error', code: 'PGRST116' };

    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useUpdateAssignmentStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      assignmentId: 'assignment-1',
      status: 'completed',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useAddConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add conflict of interest successfully', async () => {
    const mockConflict = {
      id: 'conflict-1',
      reviewer_id: 'reviewer-1',
      application_id: 'app-123',
      conflict_reason: 'Previous business relationship',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockConflict,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useAddConflict(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      reviewerId: 'reviewer-1',
      applicationId: 'app-123',
      conflictReason: 'Previous business relationship',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      reviewer_id: 'reviewer-1',
      application_id: 'app-123',
      conflict_reason: 'Previous business relationship',
    });

    expect(result.current.data).toEqual(mockConflict);
  });

  it('should handle errors', async () => {
    const mockError = { message: 'Database error', code: '23505' };

    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    });

    const { result } = renderHook(() => useAddConflict(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      reviewerId: 'reviewer-1',
      applicationId: 'app-123',
      conflictReason: 'Conflict reason',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe('useReviewerCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch reviewer categories with category names', async () => {
    const mockData = [
      {
        id: 'cat-1',
        reviewer_id: 'reviewer-1',
        category_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        categories: { name: 'Technology' },
      },
      {
        id: 'cat-2',
        reviewer_id: 'reviewer-1',
        category_id: 2,
        created_at: '2024-01-01T00:00:00Z',
        categories: { name: 'Agriculture' },
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
    });

    const { result } = renderHook(() => useReviewerCategories('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].category).toBe('Agriculture'); // Sorted alphabetically
    expect(result.current.data?.[1].category).toBe('Technology');
  });

  it('should deduplicate categories by id', async () => {
    const mockData = [
      {
        id: 'cat-1',
        reviewer_id: 'reviewer-1',
        category_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        categories: { name: 'Technology' },
      },
      {
        id: 'cat-1', // Duplicate ID
        reviewer_id: 'reviewer-1',
        category_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        categories: { name: 'Technology' },
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
    });

    const { result } = renderHook(() => useReviewerCategories('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should deduplicate
    expect(result.current.data).toHaveLength(1);
  });

  it('should return empty array when reviewerId is not provided', () => {
    const { result } = renderHook(() => useReviewerCategories(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('should handle categories without name', async () => {
    const mockData = [
      {
        id: 'cat-1',
        reviewer_id: 'reviewer-1',
        category_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        categories: null,
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
    });

    const { result } = renderHook(() => useReviewerCategories('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].category).toBe('Unknown');
  });

  it('should handle errors gracefully', async () => {
    const mockError = { message: 'Database error', code: 'PGRST301' };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
    });

    const { result } = renderHook(() => useReviewerCategories('reviewer-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

