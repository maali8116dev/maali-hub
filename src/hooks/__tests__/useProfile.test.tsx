import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfile, useUpdateProfile } from '../useProfile';
import { useAuth } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies
vi.mock('../useAuth');
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

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches profile successfully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      first_name: 'John',
      last_name: 'Doe',
      business_name: 'Tech Solutions',
      business_sector: 'Technology',
      country: 'Ghana',
      bio: 'Entrepreneur',
      avatar_url: null,
      role: 'applicant',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.firstName).toBe('John');
    expect(result.current.data?.lastName).toBe('Doe');
    expect(result.current.data?.userId).toBe('user-123');
  });

  it('returns null when profile does not exist (PGRST116)', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should return null instead of throwing error
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('does not fetch when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    // Query should be disabled
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('handles other errors by throwing', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('Database error')),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
  });

  it('transforms snake_case to camelCase correctly', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockProfile = {
      user_id: 'user-123',
      first_name: 'Jane',
      last_name: 'Smith',
      business_name: 'AgriTech',
      business_sector: 'Agriculture',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.userId).toBe('user-123');
    expect(result.current.data?.firstName).toBe('Jane');
    expect(result.current.data?.lastName).toBe('Smith');
    expect(result.current.data?.businessName).toBe('AgriTech');
    expect(result.current.data?.businessSector).toBe('Agriculture');
    expect(result.current.data?.avatarUrl).toBe('https://example.com/avatar.jpg');
  });
});

describe('useUpdateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates profile successfully', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const updatedProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      first_name: 'John Updated',
      last_name: 'Doe',
      business_name: 'Tech Solutions',
      business_sector: 'Technology',
      country: 'Ghana',
      bio: 'Updated bio',
      avatar_url: null,
      role: 'applicant',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: updatedProfile,
        error: null,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'John Updated',
      bio: 'Updated bio',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockQuery.update).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
    expect(result.current.data?.firstName).toBe('John Updated');
  });

  it('handles update errors', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'John',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

