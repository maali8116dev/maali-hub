/**
 * Integration tests — hooks hit the REAL database.
 *
 * We mock `@/integrations/supabase/client` to return a real Supabase client
 * so the hooks behave exactly as they would in the browser.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import React from 'react';

// ── Hoisted container — available to vi.mock factory ──────────────────
const shared = vi.hoisted(() => ({
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co",
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ",
  realClient: null as SupabaseClient<Database> | null,
}));

const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Mock the module to inject our real client into hooks ──────────────
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient: cc } = await import('@supabase/supabase-js');
  shared.realClient = cc<Database>(shared.SUPABASE_URL, shared.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase: shared.realClient };
});

// Service-role client for test-data setup / teardown (bypasses RLS)
const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(shared.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// Mock useAuth to return our test user
vi.mock('@/hooks/useAuth');

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import { useProfile, useUpdateProfile } from '../useProfile';
import { useAuth } from '../useAuth';

// ── Helpers ──────────────────────────────────────────────────────────
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

describe('useProfile - Integration Tests', () => {
  let testUserId: string;
  let testUserEmail: string;
  let testProfileId: string | null = null;
  const testTimestamp = Date.now();

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, skipping integration tests');
      return;
    }

    // Create test user
    testUserEmail = `int-profile-${testTimestamp}@maali.test`;
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: testUserEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (userError || !userData?.user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    testUserId = userData.user.id;

    // Sign in the real client with test user
    const { error: signInError } = await shared.realClient!.auth.signInWithPassword({
      email: testUserEmail,
      password: 'TestPassword123!',
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    // Mock useAuth to return our test user
    (useAuth as any).mockReturnValue({ user: { id: testUserId, email: testUserEmail } });
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    // Clean up test profile
    if (testProfileId) {
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', testProfileId);
    } else if (testUserId) {
      // Try to delete by user_id if we don't have profile id
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', testUserId);
    }

    // Clean up test user
    if (testUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Sign out
    await shared.realClient!.auth.signOut();
  }, 30000);

  describe('useProfile', () => {
    it('returns null when profile does not exist (PGRST116)', async () => {
      const { result } = renderHook(() => useProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // Should return null instead of throwing error
      expect(result.current.data).toBeNull();
      expect(result.current.isError).toBe(false);
    });

    it('fetches profile successfully from real database', async () => {
      // First create a profile
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: testUserId,
          first_name: 'John',
          last_name: 'Doe',
          business_name: 'Tech Solutions',
          business_sector: 'Technology',
          country: 'Ghana',
          bio: 'Entrepreneur',
          role: 'applicant',
        })
        .select('id')
        .single();

      if (!profileError && profileData) {
        testProfileId = profileData.id;
      }

      const { result } = renderHook(() => useProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data).not.toBeNull();
      expect(result.current.data?.firstName).toBe('John');
      expect(result.current.data?.lastName).toBe('Doe');
      expect(result.current.data?.userId).toBe(testUserId);
      expect(result.current.data?.businessName).toBe('Tech Solutions');
      expect(result.current.data?.businessSector).toBe('Technology');
      expect(result.current.data?.country).toBe('Ghana');
      expect(result.current.data?.bio).toBe('Entrepreneur');
    });

    it('transforms snake_case to camelCase correctly', async () => {
      // Update the profile to test transformation
      await supabaseAdmin
        .from('profiles')
        .update({
          first_name: 'Jane',
          last_name: 'Smith',
          business_name: 'AgriTech',
          business_sector: 'Agriculture',
          avatar_url: 'https://example.com/avatar.jpg',
        })
        .eq('user_id', testUserId);

      const { result } = renderHook(() => useProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data?.userId).toBe(testUserId);
      expect(result.current.data?.firstName).toBe('Jane');
      expect(result.current.data?.lastName).toBe('Smith');
      expect(result.current.data?.businessName).toBe('AgriTech');
      expect(result.current.data?.businessSector).toBe('Agriculture');
      expect(result.current.data?.avatarUrl).toBe('https://example.com/avatar.jpg');
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
  });

  describe('useUpdateProfile', () => {
    it('updates existing profile successfully', async () => {
      // Ensure profile exists
      if (!testProfileId) {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: testUserId,
            first_name: 'Initial',
            last_name: 'Name',
            role: 'applicant',
          })
          .select('id')
          .single();

        if (profileData) {
          testProfileId = profileData.id;
        }
      }

      // Restore auth mock
      (useAuth as any).mockReturnValue({ user: { id: testUserId, email: testUserEmail } });

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        bio: 'Updated bio',
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.firstName).toBe('John Updated');
      expect(result.current.data?.lastName).toBe('Doe Updated');
      expect(result.current.data?.bio).toBe('Updated bio');
    });

    it('creates new profile when update fails with PGRST116 (profile does not exist)', async () => {
      // Delete the profile first
      if (testProfileId) {
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', testProfileId);
        testProfileId = null;
      }

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        firstName: 'Jane',
        lastName: 'Smith',
        businessName: 'New Business',
        businessSector: 'Technology',
        country: 'Ghana',
        bio: 'New bio',
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // Verify the profile was created
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.firstName).toBe('Jane');
      expect(result.current.data?.lastName).toBe('Smith');
      expect(result.current.data?.businessName).toBe('New Business');
      expect(result.current.data?.businessSector).toBe('Technology');
      expect(result.current.data?.country).toBe('Ghana');
      expect(result.current.data?.bio).toBe('New bio');

      // Store the new profile ID for cleanup
      if (result.current.data?.id) {
        testProfileId = result.current.data.id;
      }
    });

    it('handles partial updates correctly', async () => {
      // Ensure profile exists
      if (!testProfileId) {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: testUserId,
            first_name: 'Initial',
            last_name: 'Name',
            role: 'applicant',
          })
          .select('id')
          .single();

        if (profileData) {
          testProfileId = profileData.id;
        }
      }

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      // Update only firstName
      result.current.mutate({
        firstName: 'Bob',
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data?.firstName).toBe('Bob');
      // Other fields should remain unchanged
    });

    it('handles avatar_url correctly (null vs undefined)', async () => {
      // Ensure profile exists
      if (!testProfileId) {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: testUserId,
            first_name: 'Test',
            last_name: 'User',
            role: 'applicant',
          })
          .select('id')
          .single();

        if (profileData) {
          testProfileId = profileData.id;
        }
      }

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      // Update with avatar_url
      result.current.mutate({
        avatarUrl: 'https://example.com/new-avatar.jpg',
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data?.avatarUrl).toBe('https://example.com/new-avatar.jpg');

      // Update with empty string (should become null)
      result.current.mutate({
        avatarUrl: '',
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // Should be null or undefined (both are acceptable for cleared avatar)
      expect(result.current.data?.avatarUrl === null || result.current.data?.avatarUrl === undefined).toBe(true);
    });
  });
});

