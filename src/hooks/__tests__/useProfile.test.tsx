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

    const dbError = { 
      code: '500',
      message: 'Database error',
      details: 'Connection failed',
      hint: null,
    };
    
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: dbError,
      }),
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.error).toBeDefined();
    // Verify the error is the one we threw
    expect(result.current.error).toMatchObject({
      message: expect.stringContaining('Database error'),
    });
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
    expect(result.current.data?.businesssector).toBe('Agriculture');
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

  it('creates new profile when update fails with PGRST116 (profile does not exist)', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const newProfile = {
      id: 'profile-456',
      user_id: 'user-123',
      first_name: 'Jane',
      last_name: 'Smith',
      business_name: 'New Business',
      business_sector: 'Technology',
      country: 'Ghana',
      bio: 'New bio',
      avatar_url: null,
      role: 'applicant',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    // Mock the update query chain (fails with PGRST116)
    const mockUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'The result contains 0 rows' },
      }),
    };

    // Mock the insert query chain (succeeds)
    const mockInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: newProfile,
        error: null,
      }),
    };

    // Make from() return different query chains for update and insert
    let callCount = 0;
    (supabase.from as any).mockImplementation(() => {
      callCount++;
      // First call is for update, second is for insert
      return callCount === 1 ? mockUpdateQuery : mockInsertQuery;
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'Jane',
      lastName: 'Smith',
      businessName: 'New Business',
      businesssector: 'Technology',
      country: 'Ghana',
      bio: 'New bio',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify update was attempted first
    expect(mockUpdateQuery.update).toHaveBeenCalled();
    expect(mockUpdateQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');

    // Verify insert was called after update failed
    expect(mockInsertQuery.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      first_name: 'Jane',
      last_name: 'Smith',
      business_name: 'New Business',
      business_sector: 'Technology',
      country: 'Ghana',
      bio: 'New bio',
      avatar_url: null, // Supabase returns null instead of undefined for missing fields
    });

    // Verify the returned data is transformed correctly
    expect(result.current.data?.firstName).toBe('Jane');
    expect(result.current.data?.lastName).toBe('Smith');
    expect(result.current.data?.businessName).toBe('New Business');
  });

  it('creates new profile when update fails with "0 rows" message', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const newProfile = {
      id: 'profile-789',
      user_id: 'user-123',
      first_name: 'Bob',
      last_name: 'Johnson',
      business_name: null,
      business_sector: 'Agriculture',
      country: 'Nigeria',
      bio: null,
      avatar_url: null,
      role: 'applicant',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    const mockUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'The result contains 0 rows' },
      }),
    };

    const mockInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: newProfile,
        error: null,
      }),
    };

    let callCount = 0;
    (supabase.from as any).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockUpdateQuery : mockInsertQuery;
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'Bob',
      lastName: 'Johnson',
      businesssector: 'Agriculture',
      country: 'Nigeria',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInsertQuery.insert).toHaveBeenCalled();
    expect(result.current.data?.firstName).toBe('Bob');
    expect(result.current.data?.country).toBe('Nigeria');
  });

  it('creates new profile when update fails with "No rows" message', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const newProfile = {
      id: 'profile-999',
      user_id: 'user-123',
      first_name: 'Alice',
      last_name: 'Williams',
      business_name: 'Startup Inc',
      business_sector: 'FinTech',
      country: 'Kenya',
      bio: 'Entrepreneur',
      avatar_url: 'https://example.com/avatar.jpg',
      role: 'applicant',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    const mockUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows returned' },
      }),
    };

    const mockInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: newProfile,
        error: null,
      }),
    };

    let callCount = 0;
    (supabase.from as any).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockUpdateQuery : mockInsertQuery;
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'Alice',
      lastName: 'Williams',
      businessName: 'Startup Inc',
      businesssector: 'FinTech',
      country: 'Kenya',
      bio: 'Entrepreneur',
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockInsertQuery.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      first_name: 'Alice',
      last_name: 'Williams',
      business_name: 'Startup Inc',
      business_sector: 'FinTech',
      country: 'Kenya',
      bio: 'Entrepreneur',
      avatar_url: 'https://example.com/avatar.jpg',
    });

    expect(result.current.data?.firstName).toBe('Alice');
    expect(result.current.data?.avatarUrl).toBe('https://example.com/avatar.jpg');
  });

  it('throws error if insert fails after update fails', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const mockUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'The result contains 0 rows' },
      }),
    };

    const mockInsertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: '23505' },
      }),
    };

    let callCount = 0;
    (supabase.from as any).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockUpdateQuery : mockInsertQuery;
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'Test',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error).toMatchObject({
      message: expect.stringContaining('Insert failed'),
    });
  });

  it('updates existing profile successfully without attempting insert', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    (useAuth as any).mockReturnValue({ user: mockUser });

    const updatedProfile = {
      id: 'profile-123',
      user_id: 'user-123',
      first_name: 'John Updated',
      last_name: 'Doe Updated',
      business_name: 'Updated Business',
      business_sector: 'Technology',
      country: 'Ghana',
      bio: 'Updated bio',
      avatar_url: null,
      role: 'applicant',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
    };

    const mockQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: updatedProfile,
        error: null,
      }),
      insert: undefined as any, // Should not be called when update succeeds
    };

    (supabase.from as any).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      firstName: 'John Updated',
      lastName: 'Doe Updated',
      businessName: 'Updated Business',
      bio: 'Updated bio',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify update was called
    expect(mockQuery.update).toHaveBeenCalled();
    expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');

    // Verify insert was NOT called (since update succeeded)
    expect(mockQuery.insert).toBeUndefined();

    expect(result.current.data?.firstName).toBe('John Updated');
    expect(result.current.data?.lastName).toBe('Doe Updated');
  });
});









