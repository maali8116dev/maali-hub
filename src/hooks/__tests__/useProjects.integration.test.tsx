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

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import { useProjects, useProjectCategories, useProjectLocations, useFeaturedProjects } from '../useProjects';

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

describe('useProjects - Integration Tests', () => {
  let testCategoryIds: number[] = [];
  let testProjectIds: number[] = [];
  const testTimestamp = Date.now();

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, skipping integration tests');
      return;
    }

    // Create test categories
    const categoryNames = ['Technology', 'Agriculture', 'FinTech'];
    for (const name of categoryNames) {
      const { data: existing } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('name', name)
        .single();

      if (existing) {
        testCategoryIds.push(existing.id);
      } else {
        const { data: newCategory, error } = await supabaseAdmin
          .from('categories')
          .insert({
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            description: `Test ${name} category`,
            is_active: true,
          })
          .select('id')
          .single();

        if (!error && newCategory) {
          testCategoryIds.push(newCategory.id);
        }
      }
    }

    // Create test projects with different categories, statuses, and locations
    const testProjects = [
      {
        title: `IntTest Project Tech ${testTimestamp}`,
        description: 'Integration test technology project',
        category_id: testCategoryIds[0] || 1,
        status: 'open',
        location: 'Ghana',
        funding_amount: '$50,000',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        featured: true,
      },
      {
        title: `IntTest Project Agri ${testTimestamp}`,
        description: 'Integration test agriculture project',
        category_id: testCategoryIds[1] || 1,
        status: 'open',
        location: 'Nigeria',
        funding_amount: '$75,000',
        deadline: new Date(Date.now() + 60 * 86400000).toISOString(),
        featured: false,
      },
      {
        title: `IntTest Project Closed ${testTimestamp}`,
        description: 'Integration test closed project',
        category_id: testCategoryIds[0] || 1,
        status: 'closed',
        location: 'Kenya',
        funding_amount: '$100,000',
        deadline: new Date(Date.now() - 10 * 86400000).toISOString(), // Past deadline
        featured: false,
      },
      {
        title: `IntTest Project FinTech ${testTimestamp}`,
        description: 'Integration test fintech project with searchable text',
        category_id: testCategoryIds[2] || 1,
        status: 'open',
        location: 'Ghana',
        funding_amount: '$60,000',
        deadline: new Date(Date.now() + 45 * 86400000).toISOString(),
        featured: true,
      },
    ];

    for (const project of testProjects) {
      const { data: newProject, error } = await supabaseAdmin
        .from('projects')
        .insert(project)
        .select('id')
        .single();

      if (!error && newProject) {
        testProjectIds.push(newProject.id);
      }
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    // Clean up test projects
    if (testProjectIds.length > 0) {
      await supabaseAdmin
        .from('projects')
        .delete()
        .in('id', testProjectIds);
    }

    // Note: We don't delete categories as they might be used by other tests
    // Categories are idempotent (ON CONFLICT DO NOTHING in seed)
  }, 30000);

  describe('useProjects', () => {
    it('fetches projects successfully from real database', async () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.projects).toBeDefined();
      expect(Array.isArray(result.current.data?.projects)).toBe(true);
      expect(result.current.data?.total).toBeGreaterThanOrEqual(0);
      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.totalPages).toBeGreaterThanOrEqual(0);
    });

    it('applies category filter correctly', async () => {
      const { result } = renderHook(
        () => useProjects({ category: 'Technology' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // All returned projects should be in Technology category
      const projects = result.current.data?.projects || [];
      if (projects.length > 0) {
        projects.forEach((project) => {
          expect(project.category).toBe('Technology');
        });
      }
    });

    it('applies status filter correctly', async () => {
      const { result } = renderHook(
        () => useProjects({ status: 'open' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // All returned projects should have status 'open'
      const projects = result.current.data?.projects || [];
      if (projects.length > 0) {
        projects.forEach((project) => {
          expect(project.status).toBe('open');
        });
      }
    });

    it('applies location filter correctly', async () => {
      const { result } = renderHook(
        () => useProjects({ location: 'Ghana' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // All returned projects should be in Ghana
      const projects = result.current.data?.projects || [];
      if (projects.length > 0) {
        projects.forEach((project) => {
          expect(project.location).toBe('Ghana');
        });
      }
    });

    it('applies search filter correctly', async () => {
      const { result } = renderHook(
        () => useProjects({ search: 'FinTech' }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      // Search should find projects with "FinTech" in title or description
      const projects = result.current.data?.projects || [];
      if (projects.length > 0) {
        const hasMatch = projects.some(
          (project) =>
            project.title.toLowerCase().includes('fintech') ||
            project.description.toLowerCase().includes('fintech')
        );
        expect(hasMatch).toBe(true);
      }
    });

    it('handles pagination correctly', async () => {
      const { result } = renderHook(
        () => useProjects({ page: 1, itemsPerPage: 2 }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.itemsPerPage).toBe(2);
      expect(result.current.data?.projects.length).toBeLessThanOrEqual(2);
      expect(result.current.data?.totalPages).toBeGreaterThanOrEqual(0);
    });

    it('handles multiple filters together', async () => {
      const { result } = renderHook(
        () =>
          useProjects({
            category: 'Technology',
            status: 'open',
            location: 'Ghana',
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      const projects = result.current.data?.projects || [];
      if (projects.length > 0) {
        projects.forEach((project) => {
          expect(project.category).toBe('Technology');
          expect(project.status).toBe('open');
          expect(project.location).toBe('Ghana');
        });
      }
    });
  });

  describe('useProjectCategories', () => {
    it('fetches unique categories from real database', async () => {
      const { result } = renderHook(() => useProjectCategories(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      
      // Should contain our test categories
      if (result.current.data && result.current.data.length > 0) {
        expect(result.current.data).toContain('Technology');
        expect(result.current.data).toContain('Agriculture');
        expect(result.current.data).toContain('FinTech');
        
        // Should be sorted alphabetically
        const sorted = [...result.current.data].sort();
        expect(result.current.data).toEqual(sorted);
        
        // Should be unique (no duplicates)
        const unique = Array.from(new Set(result.current.data));
        expect(result.current.data.length).toBe(unique.length);
      }
    });
  });

  describe('useProjectLocations', () => {
    it('fetches unique sorted locations from real database', async () => {
      const { result } = renderHook(() => useProjectLocations(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      
      if (result.current.data && result.current.data.length > 0) {
        // Should contain our test locations
        expect(result.current.data).toContain('Ghana');
        expect(result.current.data).toContain('Nigeria');
        expect(result.current.data).toContain('Kenya');
        
        // Should be sorted alphabetically
        const sorted = [...result.current.data].sort();
        expect(result.current.data).toEqual(sorted);
        
        // Should be unique (no duplicates)
        const unique = Array.from(new Set(result.current.data));
        expect(result.current.data.length).toBe(unique.length);
      }
    });
  });

  describe('useFeaturedProjects', () => {
    it('fetches featured projects excluding closed from real database', async () => {
      const { result } = renderHook(() => useFeaturedProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.isSuccess).toBe(true);
        },
        { timeout: 10000 }
      );

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      
      if (result.current.data && result.current.data.length > 0) {
        // All should be featured
        result.current.data.forEach((project) => {
          expect(project.featured).toBe(true);
          expect(project.status).not.toBe('closed');
        });
        
        // Should be limited to 6
        expect(result.current.data.length).toBeLessThanOrEqual(6);
      }
    });
  });
});

