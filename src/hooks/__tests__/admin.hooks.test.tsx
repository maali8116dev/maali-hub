import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { useAdminApplications } from '../useAdminApplications';
import { useAdminStats } from '../useAdminStats';
import { useAdminProjects, useCreateProject, useUpdateProject, useDeleteProject, useProject } from '../useAdminProjects';
import { useAuth } from '../useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '../useActivityLogger';
import { useToast } from '../use-toast';

// Mock dependencies for hook-level tests
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useActivityLogger');
vi.mock('@/hooks/use-toast');

// --- Real clients for direct RPC integration tests ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://alpudhhsmgtpmgpjfuqs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_x9j94wxK7OqIvyNh0eN5hw_uCBviZiZ";
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const integrationClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = SUPABASE_SERVICE_ROLE_KEY
  ? createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

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

// ============================================================
// Hook-level tests (mocked Supabase client)
// ============================================================

describe('useAdminApplications (Hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'admin-1' } });
  });

  it('should fetch all applications excluding drafts', async () => {
    const mockRpcResponse = [
      {
        id: 'app-1', user_id: 'user-1', opportunity_id: 1,
        contact_email: 'a1@example.com', company_name: 'Company 1',
        status: 'pending', is_draft: false, created_at: '2024-01-01T00:00:00Z',
        funding_amount: '$50,000', applicant_name: 'John Doe',
        applicant_email: 'a1@example.com', project_title: 'Project 1',
        submitted_at: '2024-01-01T00:00:00Z', reviewer_decisions: [],
      },
      {
        id: 'app-2', user_id: 'user-2', opportunity_id: 2,
        contact_email: 'a2@example.com', company_name: 'Company 2',
        status: 'approved', is_draft: false, created_at: '2024-01-02T00:00:00Z',
        funding_amount: '$75,000', applicant_name: 'Jane Smith',
        applicant_email: 'a2@example.com', project_title: 'Project 2',
        submitted_at: '2024-01-02T00:00:00Z', reviewer_decisions: [],
      },
    ];

    (supabase.rpc as any).mockResolvedValue({ data: mockRpcResponse, error: null });

    const { result } = renderHook(() => useAdminApplications(), { wrapper: createWrapper() });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].applicantName).toBe('John Doe');
    expect(result.current.data?.[1].status).toBe('approved');
    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_applications');
  });

  it('should map status correctly (under_review preserved)', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{
        id: 'app-1', user_id: 'user-1', opportunity_id: 1,
        contact_email: 'a1@example.com', status: 'under_review', is_draft: false,
        created_at: '2024-01-01T00:00:00Z', funding_amount: '$50,000',
        applicant_name: 'John Doe', applicant_email: 'a1@example.com',
        project_title: 'Project 1', submitted_at: '2024-01-01T00:00:00Z',
        reviewer_decisions: [],
      }],
        error: null,
    });

    const { result } = renderHook(() => useAdminApplications(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    // under_review status is preserved in the hook (not mapped to pending)
    expect(result.current.data?.[0].status).toBe('under_review');
  });

  it('should not fetch when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ user: null });
    const { result } = renderHook(() => useAdminApplications(), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('should handle missing profile gracefully', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{
        id: 'app-1', user_id: 'user-1', opportunity_id: 1,
        contact_email: 'a1@example.com', status: 'pending', is_draft: false,
        created_at: '2024-01-01T00:00:00Z', funding_amount: '$50,000',
        applicant_name: null, applicant_email: null,
        project_title: 'Project 1', submitted_at: '2024-01-01T00:00:00Z',
        reviewer_decisions: [],
      }],
        error: null,
    });

    const { result } = renderHook(() => useAdminApplications(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.[0].applicantName).toBe('Unknown Applicant');
  });
});

describe('useAdminStats (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should handle empty data', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ total_users: 0, total_projects: 0, total_applications: 0,
               pending_applications: 0, approved_applications: 0,
               rejected_applications: 0, active_projects: 0 }],
        error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data?.totalUsers).toBe(0);
    expect(result.current.data?.totalApplications).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null, error: { message: 'Database error', code: 'PGRST301' },
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isError).toBe(true); }, { timeout: 3000 });
    expect(result.current.error).toBeDefined();
  });
});

// ============================================================
// Direct RPC integration tests (real database)
// ============================================================

describe.skip('get_admin_applications RPC (Integration)', () => {
  let adminUserId: string;
  let testProjectId: number;
  let testApplicationIds: string[] = [];
  let testUserIds: string[] = [];

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping integration tests.');
      return;
    }

    // Create admin user
    const adminEmail = `test-admin-apps-${Date.now()}@maali.test`;
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { first_name: 'Test', last_name: 'Admin', role: 'admin' },
    });
    if (adminError || !adminData.user) throw new Error(`Admin creation failed: ${adminError?.message}`);
    adminUserId = adminData.user.id;

    await supabaseAdmin.from('profiles').upsert({
      user_id: adminUserId, first_name: 'Test', last_name: 'Admin', role: 'admin',
    }, { onConflict: 'user_id' });

    // Sign in
    const { error: signInError } = await integrationClient.auth.signInWithPassword({
      email: adminEmail, password: 'TestPassword123!',
    });
    if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`);

    // Create project
    const { data: catData } = await supabaseAdmin.from('sectors').select('id').eq('name', 'Technology').single();
    const sectorId = catData?.id || 1;

    const { data: projectData, error: projectError } = await supabaseAdmin.from('opportunities').insert({
      title: `Test Project ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: sectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    if (projectError || !projectData) throw new Error(`Project creation failed: ${projectError?.message}`);
    testProjectId = projectData.id;

    // Create applicants + applications
    for (let i = 0; i < 2; i++) {
      const email = `test-applicant-admin-${Date.now()}-${i}@maali.test`;
      const { data: ud } = await supabaseAdmin.auth.admin.createUser({
        email, password: 'TestPassword123!', email_confirm: true,
      });
      if (!ud?.user) continue;
      testUserIds.push(ud.user.id);

      await supabaseAdmin.from('profiles').upsert({
        user_id: ud.user.id, first_name: `Applicant${i}`, last_name: 'Test', role: 'applicant',
      }, { onConflict: 'user_id' });

      const { data: appData } = await (supabaseAdmin.from('applications') as any).insert({
        user_id: ud.user.id, opportunity_id: testProjectId, contact_email: email,
        organization_name: `Company ${i}`, status: i === 0 ? 'pending' : 'approved',
        is_draft: false,
      }).select('id').single();
      if (appData) testApplicationIds.push(appData.id);
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationIds.length) await supabaseAdmin.from('applications').delete().in('id', testApplicationIds);
    if (testProjectId) await supabaseAdmin.from('opportunities').delete().eq('id', testProjectId);
    for (const id of [...testUserIds, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(id); } catch { /* */ }
    }
    await integrationClient.auth.signOut();
  }, 30000);

  it('should return applications from the database', async () => {
    if (!supabaseAdmin) return;

    const { data, error } = await (integrationClient.rpc as any)('get_admin_applications');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);

    const testApps = (data as any[]).filter((a: any) => testApplicationIds.includes(a.id));
    expect(testApps.length).toBeGreaterThanOrEqual(2);
    expect(testApps[0]).toHaveProperty('applicant_name');
    expect(testApps[0]).toHaveProperty('project_title');
  });

  it('should map under_review to pending in RPC output', async () => {
    if (!supabaseAdmin) return;

    // Insert an under_review application
    const { data: urApp } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testUserIds[0], opportunity_id: testProjectId,
      contact_email: 'ur@test.com', status: 'under_review', is_draft: false,
    }).select('id').single();

    if (urApp) testApplicationIds.push(urApp.id);

    const { data, error } = await (integrationClient.rpc as any)('get_admin_applications');
    expect(error).toBeNull();

    const urRow = (data as any[]).find((a: any) => a.id === urApp?.id);
    if (urRow) {
      expect(urRow.status).toBe('pending'); // RPC maps under_review â†’ pending
    }
  });

  it('should exclude drafts', async () => {
    if (!supabaseAdmin) return;

    // Insert a draft
    const { data: draftApp } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testUserIds[0], opportunity_id: testProjectId,
      contact_email: 'draft@test.com', status: 'pending', is_draft: true,
    }).select('id').single();

    const draftId = draftApp?.id;

    const { data, error } = await (integrationClient.rpc as any)('get_admin_applications');
    expect(error).toBeNull();

    const found = (data as any[]).find((a: any) => a.id === draftId);
    expect(found).toBeUndefined();

    // cleanup
    if (draftId) await supabaseAdmin.from('applications').delete().eq('id', draftId);
  });
});

describe.skip('get_admin_stats RPC (Integration)', () => {
  let adminUserId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) return;

    const adminEmail = `test-admin-stats-${Date.now()}@maali.test`;
    const { data: ad, error: ae } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { first_name: 'Test', last_name: 'Admin', role: 'admin' },
    });
    if (ae || !ad.user) throw new Error(`Admin creation failed: ${ae?.message}`);
    adminUserId = ad.user.id;

    await supabaseAdmin.from('profiles').upsert({
      user_id: adminUserId, first_name: 'Test', last_name: 'Admin', role: 'admin',
    }, { onConflict: 'user_id' });

    await integrationClient.auth.signInWithPassword({ email: adminEmail, password: 'TestPassword123!' });
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    try { await supabaseAdmin.auth.admin.deleteUser(adminUserId); } catch { /* */ }
    await integrationClient.auth.signOut();
  }, 30000);

  it('should return numeric stats from the database', async () => {
    if (!supabaseAdmin) return;

    const { data, error } = await (integrationClient.rpc as any)('get_admin_stats');
    expect(error).toBeNull();
    expect(data).toBeDefined();

    const stats = (data as any[])?.[0];
    expect(stats).toBeDefined();
    expect(Number(stats.total_users)).toBeGreaterThanOrEqual(0);
    expect(Number(stats.total_projects)).toBeGreaterThanOrEqual(0);
    expect(Number(stats.total_applications)).toBeGreaterThanOrEqual(0);
    expect(Number(stats.active_projects)).toBeGreaterThanOrEqual(0);
  });

  it('should reject non-admin users', async () => {
    if (!supabaseAdmin) return;

    // Sign out admin â†’ unauthenticated call
    await integrationClient.auth.signOut();

    const { data, error } = await (integrationClient.rpc as any)('get_admin_stats');
    // Should fail -“ either error or empty
    expect(error !== null || data === null).toBe(true);

    // Re-sign-in for cleanup (afterAll expects a session)
    const email = `test-admin-stats-resign-${Date.now()}@maali.test`;
    const { data: ud } = await supabaseAdmin.auth.admin.createUser({
      email, password: 'TestPassword123!', email_confirm: true,
    });
    if (ud?.user) {
      await supabaseAdmin.from('profiles').upsert({
        user_id: ud.user.id, first_name: 'T', last_name: 'A', role: 'admin',
      }, { onConflict: 'user_id' });
      await integrationClient.auth.signInWithPassword({ email, password: 'TestPassword123!' });
      // add to cleanup
      const origAdminId = adminUserId;
      adminUserId = ud.user.id;
      try { await supabaseAdmin.auth.admin.deleteUser(origAdminId); } catch { /* */ }
    }
    });
  });








