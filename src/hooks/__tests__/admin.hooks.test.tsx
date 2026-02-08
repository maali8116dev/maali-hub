import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminApplications } from '../useAdminApplications';
import { useAdminStats } from '../useAdminStats';
import { useAdminProjects, useCreateProject, useUpdateProject, useDeleteProject, useProject } from '../useAdminProjects';
import { useAuth } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '../useActivityLogger';
import { useToast } from '../use-toast';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useActivityLogger');
vi.mock('@/hooks/use-toast');

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

describe('useAdminApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'admin-1' } });
  });

  it('should fetch all applications excluding drafts', async () => {
    const mockApplications = [
      {
        id: 'app-1',
        user_id: 'user-1',
        project_id: 1,
        contact_email: 'applicant1@example.com',
        company_name: 'Company 1',
        status: 'pending',
        is_draft: false,
        created_at: '2024-01-01T00:00:00Z',
        funding_amount_requested: '$50,000',
      },
      {
        id: 'app-2',
        user_id: 'user-2',
        project_id: 2,
        contact_email: 'applicant2@example.com',
        company_name: 'Company 2',
        status: 'approved',
        is_draft: false,
        created_at: '2024-01-02T00:00:00Z',
        funding_amount_requested: '$75,000',
      },
    ];

    const mockProfiles = [
      { user_id: 'user-1', first_name: 'John', last_name: 'Doe' },
      { user_id: 'user-2', first_name: 'Jane', last_name: 'Smith' },
    ];

    const mockProjects = [
      { id: 1, title: 'Project 1' },
      { id: 2, title: 'Project 2' },
    ];

    // Create separate mock chains for each table
    const mockApplicationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockApplications,
        error: null,
      }),
    };

    const mockProfilesQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: mockProfiles,
        error: null,
      }),
    };

    const mockProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: mockProjects,
        error: null,
      }),
    };

    const mockReviewScoresQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') return mockApplicationsQuery;
      if (table === 'profiles') return mockProfilesQuery;
      if (table === 'projects') return mockProjectsQuery;
      if (table === 'review_scores') return mockReviewScoresQuery;
      return mockApplicationsQuery;
    });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].applicantName).toBe('John Doe');
    expect(result.current.data?.[0].projectTitle).toBe('Project 1');
    expect(result.current.data?.[0].status).toBe('pending');
    expect(result.current.data?.[1].status).toBe('approved');
    expect(mockApplicationsQuery.eq).toHaveBeenCalledWith('is_draft', false);
  });

  it('should map status correctly (under_review to pending)', async () => {
    const mockApplications = [
      {
        id: 'app-1',
        user_id: 'user-1',
        project_id: 1,
        contact_email: 'applicant1@example.com',
        status: 'under_review',
        is_draft: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockApplicationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockApplications,
        error: null,
      }),
    };

    const mockEmptyQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const mockReviewScoresQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') return mockApplicationsQuery;
      if (table === 'review_scores') return mockReviewScoresQuery;
      return mockEmptyQuery;
    });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].status).toBe('pending');
  });

  it('should return empty array when no applications exist', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should include reviewer decisions when available', async () => {
    const mockApplications = [
      {
        id: 'app-1',
        user_id: 'user-1',
        project_id: 1,
        contact_email: 'applicant1@example.com',
        status: 'pending',
        is_draft: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockReviewScores = [
      {
        application_id: 'app-1',
        reviewer_id: 'reviewer-1',
        recommendation: 'approve',
        overall_score: 8.5,
        comments: 'Great application',
        submitted_at: '2024-01-02T00:00:00Z',
        reviewer: {
          user_id: 'reviewer-1',
          first_name: 'Reviewer',
          last_name: 'One',
        },
      },
    ];

    const mockApplicationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockApplications,
        error: null,
      }),
    };

    const mockEmptyQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const mockReviewScoresQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockReviewScores,
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') return mockApplicationsQuery;
      if (table === 'review_scores') return mockReviewScoresQuery;
      return mockEmptyQuery;
    });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].reviewerDecisions).toHaveLength(1);
    expect(result.current.data?.[0].reviewerDecisions?.[0].recommendation).toBe('approve');
    expect(result.current.data?.[0].reviewerDecisions?.[0].reviewerName).toBe('Reviewer One');
  });

  it('should not fetch when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('should handle missing profile gracefully', async () => {
    const mockApplications = [
      {
        id: 'app-1',
        user_id: 'user-1',
        project_id: 1,
        contact_email: 'applicant1@example.com',
        status: 'pending',
        is_draft: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockApplicationsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: mockApplications,
        error: null,
      }),
    };

    const mockEmptyQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [], // No profile found
        error: null,
      }),
    };

    const mockReviewScoresQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') return mockApplicationsQuery;
      if (table === 'review_scores') return mockReviewScoresQuery;
      return mockEmptyQuery;
    });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].applicantName).toBe('Unknown Applicant');
  });
});

describe('useAdminStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('should calculate all statistics correctly', async () => {
    const mockApplications = [
      { id: 'app-1', status: 'pending' },
      { id: 'app-2', status: 'pending' },
      { id: 'app-3', status: 'approved' },
      { id: 'app-4', status: 'approved' },
      { id: 'app-5', status: 'rejected' },
    ];

    // Track calls to differentiate between the two projects queries
    const projectsCalls: any[] = [];
    
    const mockProfilesQuery = {
      select: vi.fn().mockReturnValue({
        head: vi.fn().mockResolvedValue({
          count: 100,
          error: null,
        }),
      }),
    };

    const mockProjectsQuery = {
      select: vi.fn().mockImplementation((columns: string, options?: any) => {
        // If options has head: true, it's a count query
        if (options?.head) {
          projectsCalls.push('count');
          // First call is total projects, second is active projects
          if (projectsCalls.length === 1) {
            return {
              head: vi.fn().mockResolvedValue({
                count: 50,
                error: null,
              }),
            };
          } else {
            return {
              eq: vi.fn().mockReturnValue({
                head: vi.fn().mockResolvedValue({
                  count: 30,
                  error: null,
                }),
              }),
            };
          }
        }
        return mockProjectsQuery;
      }),
      eq: vi.fn().mockReturnThis(),
    };

    const mockApplicationsQuery = {
      select: vi.fn().mockResolvedValue({
        data: mockApplications,
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') return mockProfilesQuery;
      if (table === 'applications') return mockApplicationsQuery;
      if (table === 'projects') return mockProjectsQuery;
      return mockProfilesQuery;
    });

    const { result } = renderHook(() => useAdminStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.totalUsers).toBe(100);
    expect(result.current.data?.totalProjects).toBe(50);
    expect(result.current.data?.totalApplications).toBe(5);
    expect(result.current.data?.pendingApplications).toBe(2);
    expect(result.current.data?.approvedApplications).toBe(2);
    expect(result.current.data?.rejectedApplications).toBe(1);
    expect(result.current.data?.activeProjects).toBe(30);
  });

  it('should handle empty data', async () => {
    const mockEmptyCountQuery = {
      select: vi.fn().mockReturnThis(),
      head: vi.fn().mockResolvedValue({
        count: 0,
        error: null,
      }),
    };

    const mockEmptyDataQuery = {
      select: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const mockProjectsActiveQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      head: vi.fn().mockResolvedValue({
        count: 0,
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'applications') return mockEmptyDataQuery;
      if (table === 'projects') {
        // Return different mocks for total vs active
        if (mockEmptyCountQuery.select.mock.calls.length < 2) {
          return mockEmptyCountQuery;
        }
        return mockProjectsActiveQuery;
      }
      return mockEmptyCountQuery;
    });

    const { result } = renderHook(() => useAdminStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.totalUsers).toBe(0);
    expect(result.current.data?.totalApplications).toBe(0);
    expect(result.current.data?.pendingApplications).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const mockError = { message: 'Database error', code: 'PGRST301' };

    const mockSelect = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
    });

    const { result } = renderHook(() => useAdminStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

describe('useAdminProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all projects with categories', async () => {
    const mockProjects = [
      {
        id: 1,
        title: 'Project 1',
        description: 'Description 1',
        status: 'open',
        category_id: 1,
        categories: { name: 'Technology' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: mockProjects,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      order: mockOrder,
    });

    const { result } = renderHook(() => useAdminProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].category).toBe('Technology');
    expect(result.current.data?.[0].title).toBe('Project 1');
  });

  it('should return empty array when no projects exist', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      order: mockOrder,
    });

    const { result } = renderHook(() => useAdminProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});

describe('useProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single project by ID', async () => {
    const mockProject = {
      id: 1,
      title: 'Project 1',
      description: 'Description 1',
      status: 'open',
      category_id: 1,
      categories: { name: 'Technology' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: mockProject,
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    const { result } = renderHook(() => useProject(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe(1);
    expect(result.current.data?.title).toBe('Project 1');
    expect(mockEq).toHaveBeenCalledWith('id', 1);
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useProject(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('useCreateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useActivityLogger as any).mockReturnValue({
      logActivity: vi.fn().mockResolvedValue(undefined),
    });
    (useToast as any).mockReturnValue({
      toast: vi.fn(),
    });
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: 'admin-1' } } },
      error: null,
    });
  });

  it('should create a project successfully', async () => {
    const mockCategory = { id: 1, name: 'Technology' };
    const mockProject = {
      id: 1,
      title: 'New Project',
      description: 'Description',
      status: 'open',
      category_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn();
    const mockInsert = vi.fn().mockReturnThis();

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle.mockResolvedValueOnce({
            data: mockCategory,
            error: null,
          }),
        };
      }
      if (table === 'projects') {
        return {
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle.mockResolvedValueOnce({
            data: mockProject,
            error: null,
          }),
        };
      }
      return { select: mockSelect, eq: mockEq, single: mockSingle };
    });

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      title: 'New Project',
      description: 'Description',
      category: 'Technology',
      status: 'open',
      deadline: '2024-12-31',
      fundingAmount: '$50,000',
      location: 'Ghana',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it('should handle invalid category', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    const { result } = renderHook(() => useCreateProject(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      title: 'New Project',
      category: 'Invalid Category',
      status: 'open',
      deadline: '2024-12-31',
      fundingAmount: '$50,000',
      location: 'Ghana',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('Category');
  });
});

describe('useUpdateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useActivityLogger as any).mockReturnValue({
      logActivity: vi.fn().mockResolvedValue(undefined),
    });
    (useToast as any).mockReturnValue({
      toast: vi.fn(),
    });
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: 'admin-1' } } },
      error: null,
    });
  });

  it('should update a project successfully', async () => {
    const mockCategory = { id: 1, name: 'Technology' };
    const mockProject = {
      id: 1,
      title: 'Updated Project',
      description: 'Updated Description',
      status: 'open',
      category_id: 1,
      categories: { name: 'Technology' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    let categoriesCallCount = 0;
    const mockCategoriesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        categoriesCallCount++;
        if (categoriesCallCount === 1) {
          // First call for is_active check
          return Promise.resolve({ data: mockCategory, error: null });
        }
        // Second call for name check
        return Promise.resolve({ data: mockCategory, error: null });
      }),
    };

    const mockProjectsQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProject,
        error: null,
      }),
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'categories') return mockCategoriesQuery;
      if (table === 'projects') return mockProjectsQuery;
      return mockCategoriesQuery;
    });

    const { result } = renderHook(() => useUpdateProject(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 1,
      data: {
        title: 'Updated Project',
        description: 'Updated Description',
        category: 'Technology',
        status: 'open',
        deadline: '2024-12-31',
        fundingAmount: '$50,000',
        location: 'Ghana',
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    expect(mockProjectsQuery.update).toHaveBeenCalled();
  });
});

describe('useDeleteProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useActivityLogger as any).mockReturnValue({
      logActivity: vi.fn().mockResolvedValue(undefined),
    });
    (useToast as any).mockReturnValue({
      toast: vi.fn(),
    });
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: 'admin-1' } } },
      error: null,
    });
  });

  it('should delete a project successfully', async () => {
    const mockProjectForFetch = {
      id: 1,
      title: 'Project to Delete',
    };

    let callCount = 0;
    const mockProjectsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: fetch project title
          return Promise.resolve({ data: mockProjectForFetch, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      delete: vi.fn().mockReturnThis(),
    };

    // Mock the delete chain separately
    const mockDeleteChain = {
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    mockProjectsQuery.delete.mockReturnValue(mockDeleteChain);

    (supabase.from as any).mockReturnValue(mockProjectsQuery);

    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    expect(mockProjectsQuery.delete).toHaveBeenCalled();
    expect(mockDeleteChain.eq).toHaveBeenCalledWith('id', 1);
  });

  it('should handle errors when deleting', async () => {
    const mockError = { message: 'Database error', code: 'PGRST116' };

    const mockDelete = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: null,
      error: mockError,
    });

    (supabase.from as any).mockReturnValue({
      delete: mockDelete,
      eq: mockEq,
    });

    const { result } = renderHook(() => useDeleteProject(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

