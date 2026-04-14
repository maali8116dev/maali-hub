import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import {
  useAssignReviewers,
  useApplicationAssignments,
  useReviewerAssignments,
  useReviewerWorkload,
  useSystemRubric,
  useUpdateAssignmentStatus,
  useAddConflict,
  useReviewersectors,
} from '../useReviewerAssignment';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

// Mock Supabase client for hook-level tests
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock useAuth and useUserRole
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useUserRole', () => ({
  useUserRole: vi.fn(),
}));

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

describe('useAssignReviewers (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should successfully assign reviewers to application', async () => {
    const mockData = [
      { reviewer_id: 'reviewer-1', assignment_id: 'assignment-1' },
      { reviewer_id: 'reviewer-2', assignment_id: 'assignment-2' },
    ];
    (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useAssignReviewers(), { wrapper: createWrapper() });
    result.current.mutate({ applicationId: 'app-123', numReviewers: 2 });

    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(supabase.rpc).toHaveBeenCalledWith('assign_reviewers_to_application', {
      p_application_id: 'app-123', p_num_reviewers: 2,
    });
    expect(result.current.data).toEqual(mockData);
  });

  it('should use default numReviewers of 2', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: [{ reviewer_id: 'r-1', assignment_id: 'a-1' }, { reviewer_id: 'r-2', assignment_id: 'a-2' }],
      error: null,
    });

    const { result } = renderHook(() => useAssignReviewers(), { wrapper: createWrapper() });
    result.current.mutate({ applicationId: 'app-123' });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(supabase.rpc).toHaveBeenCalledWith('assign_reviewers_to_application', {
      p_application_id: 'app-123', p_num_reviewers: 2,
    });
  });

  it('should handle insufficient reviewers error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null, error: { message: 'Not enough available reviewers for sector. Need 2 reviewers, found 1', code: 'P0001' },
    });
    const { result } = renderHook(() => useAssignReviewers(), { wrapper: createWrapper() });
    result.current.mutate({ applicationId: 'app-123', numReviewers: 2 });
    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error).toBeDefined();
  });

  it('should handle already assigned error', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: null, error: { message: 'Reviewers already assigned to this application', code: 'P0001' },
    });
    const { result } = renderHook(() => useAssignReviewers(), { wrapper: createWrapper() });
    result.current.mutate({ applicationId: 'app-123', numReviewers: 2 });
    await waitFor(() => { expect(result.current.isError).toBe(true); });
    expect(result.current.error?.message).toContain('already assigned');
  });
});

describe('useApplicationAssignments (Hook)', () => {
  beforeEach(() => { 
    vi.clearAllMocks();
    // Mock useAuth and useUserRole
    (useAuth as any).mockReturnValue({
      user: { id: 'admin-1', email: 'admin@test.com' },
    });
    (useUserRole as any).mockReturnValue({
      data: 'admin',
      isLoading: false,
    });
  });

  it('should fetch assignments for an application with reviewer profiles', async () => {
    const mockData = [
      { id: 'a-1', application_id: 'app-123', reviewer_id: 'r-1', assigned_at: '2024-01-01', status: 'pending',
        reviewer_user_id: 'r-1', reviewer_first_name: 'John', reviewer_last_name: 'Doe' },
      { id: 'a-2', application_id: 'app-123', reviewer_id: 'r-2', assigned_at: '2024-01-01', status: 'in_progress',
        reviewer_user_id: 'r-2', reviewer_first_name: 'Jane', reviewer_last_name: 'Smith' },
    ];
    (supabase.rpc as any).mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useApplicationAssignments('app-123'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].reviewer).toEqual({ user_id: 'r-1', first_name: 'John', last_name: 'Doe' });
  });

  it('should not fetch when applicationId is empty', () => {
    const { result } = renderHook(() => useApplicationAssignments(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('useReviewerWorkload (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate reviewer workload correctly', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: 5, error: null });
    const { result } = renderHook(() => useReviewerWorkload('r-1'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toBe(5);
    expect(supabase.rpc).toHaveBeenCalledWith('get_reviewer_workload', { p_reviewer_id: 'r-1' });
  });

  it('should not fetch when reviewerId is not provided', () => {
    const { result } = renderHook(() => useReviewerWorkload(undefined), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

describe('useUpdateAssignmentStatus (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should update assignment status successfully', async () => {
    const mockAssignment = { id: 'a-1', application_id: 'app-123', reviewer_id: 'r-1', status: 'in_progress', assigned_at: '2024-01-01' };
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockAssignment, error: null });

    (supabase.from as any).mockReturnValue({ update: mockUpdate, eq: mockEq, select: mockSelect, single: mockSingle });

    const { result } = renderHook(() => useUpdateAssignmentStatus(), { wrapper: createWrapper() });
    result.current.mutate({ assignmentId: 'a-1', status: 'in_progress' });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'in_progress' });
  });
});

describe('useAddConflict (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should add conflict of interest successfully', async () => {
    const mockConflict = { id: 'c-1', reviewer_id: 'r-1', application_id: 'app-123', conflict_reason: 'Reason', created_at: '2024-01-01' };
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: mockConflict, error: null });

    (supabase.from as any).mockReturnValue({ insert: mockInsert, select: mockSelect, single: mockSingle });

    const { result } = renderHook(() => useAddConflict(), { wrapper: createWrapper() });
    result.current.mutate({ reviewerId: 'r-1', applicationId: 'app-123', conflictReason: 'Reason' });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(mockInsert).toHaveBeenCalledWith({ reviewer_id: 'r-1', application_id: 'app-123', conflict_reason: 'Reason' });
  });
});

describe('useReviewersectors (Hook)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should fetch reviewer sectors with sector names', async () => {
    const mockData = [
      { id: 'c-1', reviewer_id: 'r-1', sector_id: 1, created_at: '2024-01-01', sectors: { name: 'Technology' } },
      { id: 'c-2', reviewer_id: 'r-1', sector_id: 2, created_at: '2024-01-01', sectors: { name: 'Agriculture' } },
    ];
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: mockData, error: null });
    (supabase.from as any).mockReturnValue({ select: mockSelect, eq: mockEq });

    const { result } = renderHook(() => useReviewersectors('r-1'), { wrapper: createWrapper() });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].sector).toBe('Agriculture'); // sorted
    expect(result.current.data?.[1].sector).toBe('Technology');
  });

  it('should not fetch when reviewerId is not provided', () => {
    const { result } = renderHook(() => useReviewersectors(undefined), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});

// ============================================================
// Direct RPC integration tests (real database)
// ============================================================

describe.skip('assign_reviewers_to_application RPC (Integration)', () => {
  let testApplicationId: string;
  let testProjectId: number;
  let testsectorId: number;
  let testReviewerIds: string[] = [];
  let testApplicantId: string;
  let adminUserId: string;

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('âš ï¸  SUPABASE_SERVICE_ROLE_KEY not set -” skipping integration tests.');
      return;
    }

    // Create admin user and sign in (RPCs require authenticated user)
    const adminEmail = `test-admin-assign-${Date.now()}@maali.test`;
    const { data: ad } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail, password: 'TestPassword123!', email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    adminUserId = ad!.user!.id;
    await supabaseAdmin.from('profiles').upsert({
      user_id: adminUserId, first_name: 'T', last_name: 'A', role: 'admin',
    }, { onConflict: 'user_id' });
    await integrationClient.auth.signInWithPassword({ email: adminEmail, password: 'TestPassword123!' });

    // sector
    let { data: catData } = await supabaseAdmin.from('sectors').select('id').eq('name', 'Technology').single();
    testsectorId = catData?.id || 1;

    // Project
    const { data: pj } = await supabaseAdmin.from('opportunities' as any).insert({
      title: `Test Assign Project ${Date.now()}`, description: 'Test', status: 'open',
      sector_id: testsectorId, application_fee: 10000, funding_amount: '$50,000',
      location: 'Ghana', deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select('id').single();
    testProjectId = pj!.id;

    // Applicant
    const aEmail = `test-app-assign-${Date.now()}@maali.test`;
    const { data: au } = await supabaseAdmin.auth.admin.createUser({ email: aEmail, password: 'TestPassword123!', email_confirm: true });
    testApplicantId = au!.user!.id;
    await supabaseAdmin.from('profiles').upsert({ user_id: testApplicantId, first_name: 'T', last_name: 'A', role: 'applicant' }, { onConflict: 'user_id' });

    // Application
    const { data: app } = await (supabaseAdmin.from('applications') as any).insert({
      user_id: testApplicantId, opportunity_id: testProjectId, contact_email: aEmail,
      company_name: 'Test', status: 'pending', is_draft: false,
    }).select('id').single();
    testApplicationId = app!.id;

    // Reviewers (3 for Technology)
    for (let i = 0; i < 3; i++) {
      const rEmail = `test-rev-assign-${Date.now()}-${i}@maali.test`;
      const { data: ru } = await supabaseAdmin.auth.admin.createUser({ email: rEmail, password: 'TestPassword123!', email_confirm: true });
      if (!ru?.user) continue;
      testReviewerIds.push(ru.user.id);
      await supabaseAdmin.from('profiles').upsert({ user_id: ru.user.id, first_name: `Rev${i}`, last_name: 'T', role: 'reviewer' }, { onConflict: 'user_id' });
      await supabaseAdmin.from('reviewer_sectors').insert({ reviewer_id: ru.user.id, sector_id: testsectorId });
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;
    if (testApplicationId) {
      await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
      await supabaseAdmin.from('applications').delete().eq('id', testApplicationId);
    }
    if (testProjectId) await supabaseAdmin.from('opportunities' as any).delete().eq('id', testProjectId);
    for (const rid of testReviewerIds) await supabaseAdmin.from('reviewer_sectors').delete().eq('reviewer_id', rid);
    for (const uid of [...testReviewerIds, testApplicantId, adminUserId]) {
      try { await supabaseAdmin.auth.admin.deleteUser(uid); } catch { /* */ }
    }
    await integrationClient.auth.signOut();
  }, 30000);

  beforeEach(async () => {
    if (!supabaseAdmin || !testApplicationId) return;
    // Clear assignments before each test
    await supabaseAdmin.from('application_assignments').delete().eq('application_id', testApplicationId);
  });

  it('should assign reviewers via RPC', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    const { data, error } = await integrationClient.rpc('assign_reviewers_to_application', {
      p_application_id: testApplicationId,
      p_num_reviewers: 2,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(2);
    expect((data as any[])[0]).toHaveProperty('reviewer_id');
    expect((data as any[])[0]).toHaveProperty('assignment_id');
  });

  it('should fail when already assigned', async () => {
    if (!supabaseAdmin || testReviewerIds.length < 2) return;

    // First assignment
    await integrationClient.rpc('assign_reviewers_to_application', {
      p_application_id: testApplicationId, p_num_reviewers: 2,
    });

    // Second attempt
    const { error } = await integrationClient.rpc('assign_reviewers_to_application', {
      p_application_id: testApplicationId, p_num_reviewers: 2,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('already assigned');
  });

  it('should fail with insufficient reviewers', async () => {
    if (!supabaseAdmin) return;

    // Request more reviewers than could possibly exist for the sector
    const { error } = await integrationClient.rpc('assign_reviewers_to_application', {
      p_application_id: testApplicationId, p_num_reviewers: 999,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('Not enough available reviewers');
  });
});








