import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects, useProjectCategories, useProjectLocations, useFeaturedProjects } from '../useProjects';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches projects successfully', async () => {
    const mockProjects = [
      {
        id: 1,
        title: 'Test Project',
        description: 'Test Description',
        category: 'Technology',
        status: 'open',
        deadline: '2024-12-31',
        funding_amount: '$50,000',
        location: 'Ghana',
        image_url: null,
        requirements: null,
        eligibility_criteria: null,
        application_fee: '100',
        max_applicants: 50,
        current_applicants: 0,
        featured: false,
        created_by: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    (supabase.from as any).mockReturnValue(mockQuery);
    mockQuery.range.mockResolvedValue({
      data: mockProjects,
      error: null,
      count: 1,
    });

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.projects).toHaveLength(1);
    expect(result.current.data?.projects[0].title).toBe('Test Project');
    expect(result.current.data?.total).toBe(1);
  });

  it('applies category filter', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    renderHook(() => useProjects({ category: 'Technology' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockQuery.eq).toHaveBeenCalledWith('categories.name', 'Technology');
    });
  });

  it('applies status filter', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    renderHook(() => useProjects({ status: 'open' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
    });
  });

  it('applies search filter', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    renderHook(() => useProjects({ search: 'test' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockQuery.or).toHaveBeenCalled();
    });
  });

  it('handles pagination correctly', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 20,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(
      () => useProjects({ page: 2, itemsPerPage: 10 }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should calculate offset as (2-1) * 10 = 10
    expect(mockQuery.range).toHaveBeenCalledWith(10, 19);
    expect(result.current.data?.page).toBe(2);
    expect(result.current.data?.totalPages).toBe(2);
  });

  it('handles errors gracefully', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockRejectedValue(new Error('Database error')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});

describe('useProjectCategories', () => {
  it('fetches unique categories', async () => {
    const mockData = [
      { name: 'Technology' },
      { name: 'Agriculture' },
      { name: 'Technology' }, // Duplicate (should be deduplicated)
    ];

    // Create a chainable mock that supports .select().eq().order()
    const mockOrder = vi.fn().mockResolvedValue({
      data: mockData,
      error: null,
    });
    
    const mockEq = vi.fn().mockReturnValue({
      order: mockOrder,
    });
    
    const mockSelect = vi.fn().mockReturnValue({
      eq: mockEq,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useProjectCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 3000 });

    // Should return unique category names (deduplicated)
    expect(result.current.data).toEqual(['Technology', 'Agriculture']);
    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(mockSelect).toHaveBeenCalledWith('name');
    expect(mockEq).toHaveBeenCalledWith('is_active', true);
    expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true });
  });
});

describe('useProjectLocations', () => {
  it('fetches unique sorted locations', async () => {
    const mockData = [
      { location: 'Nigeria' },
      { location: 'Ghana' },
      { location: 'Kenya' },
    ];

    const mockQuery = {
      select: vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProjectLocations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return sorted locations
    expect(result.current.data).toEqual(['Ghana', 'Kenya', 'Nigeria']);
  });
});

describe('useFeaturedProjects', () => {
  it('fetches featured projects excluding closed', async () => {
    const mockProjects = [
      {
        id: 1,
        title: 'Featured Project',
        featured: true,
        status: 'open',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: mockProjects,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useFeaturedProjects(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockQuery.eq).toHaveBeenCalledWith('featured', true);
    expect(mockQuery.neq).toHaveBeenCalledWith('status', 'closed');
    expect(mockQuery.limit).toHaveBeenCalledWith(6);
  });
});

