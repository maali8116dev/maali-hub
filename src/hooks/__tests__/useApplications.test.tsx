import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApplications } from '../useApplications';
import { useAuth } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies
vi.mock('../useAuth');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
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

describe('useApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches applications with project details successfully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockApplication = {
      id: 'app-1',
      user_id: 'user-123',
      project_id: 1,
      company_name: 'Tech Solutions',
      contact_email: 'john@tech.com',
      contact_phone: '+1234567890',
      project_description: 'Innovative solution',
      funding_amount_requested: '$50,000',
      status: 'pending',
      location: 'Ghana',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    const mockProject = {
      id: 1,
      title: 'AgriTech Innovation Fund',
      sector: 'Agriculture',
      status: 'open',
      deadline: '2024-12-31',
    };

    // Mock RPC call
    (supabase.rpc as any).mockResolvedValue({
      data: [
        {
          application: mockApplication,
          project: mockProject,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].opportunityTitle).toBe('AgriTech Innovation Fund');
    expect(result.current.data?.[0].contactEmail).toBe('john@tech.com');
    expect(result.current.data?.[0].status).toBe('pending');
  });

  it('returns empty array when user has no applications', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    // Mock RPC call returning empty array
    (supabase.rpc as any).mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('handles missing project gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockApplication = {
      id: 'app-1',
      user_id: 'user-123',
      project_id: 999, // Non-existent project
      company_name: 'Tech Solutions',
      contact_email: 'john@tech.com',
      status: 'pending',
      location: 'Ghana',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    // Mock RPC call with null project (project doesn't exist)
    (supabase.rpc as any).mockResolvedValue({
      data: [
        {
          application: mockApplication,
          project: null, // Project not found
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should still return application with "Unknown Project" as title
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].opportunityTitle).toBe('Unknown Opportunity');
    expect(result.current.data?.[0].sector).toBe('Unknown');
  });

  it('maps status correctly', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockApplication = {
      id: 'app-1',
      user_id: 'user-123',
      project_id: 1,
      company_name: 'Tech Solutions',
      contact_email: 'john@tech.com',
      status: 'under_review', // Should map to 'pending'
      location: 'Ghana',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    const mockProject = {
      id: 1,
      title: 'Test Project',
      sector: 'Technology',
      status: 'open',
      deadline: '2024-12-31',
    };

    // Mock RPC call
    (supabase.rpc as any).mockResolvedValue({
      data: [
        {
          application: mockApplication,
          project: mockProject,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // under_review should map to pending
    expect(result.current.data?.[0].status).toBe('pending');
  });

  it('does not fetch when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    // Query should be disabled when user is null
    // When query is disabled, React Query doesn't run queryFn, so data is undefined
    expect(result.current.isFetching).toBe(false);
    // When query is disabled, data is undefined (not []), because queryFn never runs
    expect(result.current.data).toBeUndefined();
  });

  it('handles errors gracefully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    // Mock RPC call with error
    (supabase.rpc as any).mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });
});









