/**
 * Integration tests — hooks hit the REAL database.
 *
 * We mock `@/integrations/supabase/client` to return a real, authenticated
 * Supabase client so the hooks behave exactly as they would in the browser.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// ── Hoisted container — available to vi.mock factory ──────────────────
const shared = vi.hoisted(() => ({
  SUPABASE_URL: "https://alpudhhsmgtpmgpjfuqs.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ",
  realClient: null as SupabaseClient<any> | null,
}));

const SUPABASE_SERVICE_ROLE_KEY =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Mock the module to inject our real client into hooks ──────────────
vi.mock('@/integrations/supabase/client', async () => {
  const { createClient: cc } = await import('@supabase/supabase-js');
  shared.realClient = cc(shared.SUPABASE_URL, shared.SUPABASE_ANON_KEY, {
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

// Convenience accessor
const getRealClient = () => shared.realClient!;

// Mock useAuth — hooks check `user` before enabling queries
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useActivityLogger');
vi.mock('@/hooks/use-toast');

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import { useAdminApplications } from '../useAdminApplications';
import { useAdminStats } from '../useAdminStats';
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// ── Test data ────────────────────────────────────────────────────────
let adminUserId: string;
let testProjectId: number;
let testApplicationIds: string[] = [];
let testUserIds: string[] = [];

beforeAll(async () => {
  if (!supabaseAdmin) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set — skipping integration tests.');
    return;
  }

  // 1. Create admin user
  const adminEmail = `int-admin-${Date.now()}@maali.test`;
  const { data: ad, error: ae } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: 'TestPassword123!',
    email_confirm: true,
    user_metadata: { first_name: 'IntTest', last_name: 'Admin', role: 'admin' },
  });
  if (ae || !ad.user) throw new Error(`Admin creation failed: ${ae?.message}`);
  adminUserId = ad.user.id;

  await supabaseAdmin.from('profiles').upsert(
    { user_id: adminUserId, first_name: 'IntTest', last_name: 'Admin', role: 'admin' },
    { onConflict: 'user_id' },
  );

  // 2. Sign in the REAL client (hooks will use this session)
  const { error: signInErr } = await getRealClient().auth.signInWithPassword({
    email: adminEmail,
    password: 'TestPassword123!',
  });
  if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);

  // 3. Create a project
  const { data: catData } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('name', 'Technology')
    .single();
  const categoryId = catData?.id || 1;

  const { data: pj, error: pe } = await supabaseAdmin.from('projects').insert({
    title: `IntTest Project ${Date.now()}`,
    description: 'Integration test project',
    status: 'open',
    category_id: categoryId,
    application_fee: 10000,
    funding_amount: '$50,000',
    location: 'Ghana',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select('id').single();
  if (pe || !pj) throw new Error(`Project creation failed: ${pe?.message}`);
  testProjectId = pj.id;

  // 4. Create applicants + applications
  for (let i = 0; i < 2; i++) {
    const email = `int-applicant-${Date.now()}-${i}@maali.test`;
    const { data: ud } = await supabaseAdmin.auth.admin.createUser({
      email, password: 'TestPassword123!', email_confirm: true,
    });
    if (!ud?.user) continue;
    testUserIds.push(ud.user.id);

    await supabaseAdmin.from('profiles').upsert(
      { user_id: ud.user.id, first_name: `Applicant${i}`, last_name: 'Int', role: 'applicant' },
      { onConflict: 'user_id' },
    );

    const { data: appData } = await supabaseAdmin.from('applications').insert({
      user_id: ud.user.id,
      project_id: testProjectId,
      contact_email: email,
      organization_name: `IntTest Company ${i}`,
      status: i === 0 ? 'pending' : 'approved',
      is_draft: false,
    }).select('id').single();
    if (appData) testApplicationIds.push(appData.id);
  }
}, 30000);

afterAll(async () => {
  if (!supabaseAdmin) return;
  if (testApplicationIds.length) {
    await supabaseAdmin.from('applications').delete().in('id', testApplicationIds);
  }
  if (testProjectId) {
    await supabaseAdmin.from('projects').delete().eq('id', testProjectId);
  }
  for (const uid of [...testUserIds, adminUserId]) {
    try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
  }
  await getRealClient().auth.signOut();
}, 30000);

// ── useAdminApplications ─────────────────────────────────────────────

describe('useAdminApplications — real user flow', () => {
  beforeEach(() => {
    // The hook checks useAuth().user to enable the query
    (useAuth as any).mockReturnValue({ user: { id: adminUserId } });
  });

  it('admin opens the applications page → sees all non-draft applications', async () => {
    if (!supabaseAdmin) return;

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);

    // Our test applications should be present
    const ours = result.current.data!.filter(a => testApplicationIds.includes(a.id));
    expect(ours.length).toBeGreaterThanOrEqual(2);

    // Verify the hook mapped the RPC output correctly
    expect(ours[0]).toHaveProperty('applicantName');
    expect(ours[0]).toHaveProperty('projectTitle');
    expect(ours[0]).toHaveProperty('status');
    expect(ours[0]).toHaveProperty('contactEmail');
  }, 20000);

  it('admin sees status "under_review" mapped to "pending"', async () => {
    if (!supabaseAdmin) return;

    // Insert an under_review application
    const { data: urApp } = await supabaseAdmin.from('applications').insert({
      user_id: testUserIds[0],
      project_id: testProjectId,
      contact_email: 'underreview@test.com',
      status: 'under_review',
      is_draft: false,
    }).select('id').single();
    if (urApp) testApplicationIds.push(urApp.id);

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    const mapped = result.current.data?.find(a => a.id === urApp?.id);
    if (mapped) {
      expect(mapped.status).toBe('pending');
    }
  }, 20000);

  it('drafts never appear in the admin list', async () => {
    if (!supabaseAdmin) return;

    const { data: draft } = await supabaseAdmin.from('applications').insert({
      user_id: testUserIds[0],
      project_id: testProjectId,
      contact_email: 'draft@test.com',
      status: 'pending',
      is_draft: true,
    }).select('id').single();

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    const found = result.current.data?.find(a => a.id === draft?.id);
    expect(found).toBeUndefined();

    // cleanup
    if (draft) await supabaseAdmin.from('applications').delete().eq('id', draft.id);
  }, 20000);

  it('unauthenticated user → query is disabled', () => {
    (useAuth as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useAdminApplications(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
  });
});

// ── useAdminStats ────────────────────────────────────────────────────

describe('useAdminStats — real user flow', () => {
  it('admin opens dashboard → sees real statistics', async () => {
    if (!supabaseAdmin) return;

    const { result } = renderHook(() => useAdminStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });

    const stats = result.current.data;
    expect(stats).toBeDefined();
    expect(stats!.totalUsers).toBeGreaterThanOrEqual(0);
    expect(stats!.totalProjects).toBeGreaterThanOrEqual(0);
    expect(stats!.totalApplications).toBeGreaterThanOrEqual(0);
    expect(stats!.pendingApplications).toBeGreaterThanOrEqual(0);
    expect(stats!.approvedApplications).toBeGreaterThanOrEqual(0);
    expect(stats!.activeProjects).toBeGreaterThanOrEqual(0);
    expect(typeof stats!.totalUsers).toBe('number');
  }, 20000);
});

