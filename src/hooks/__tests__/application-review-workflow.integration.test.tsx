/**
 * Integration tests — complete review workflow hits the REAL database.
 *
 * Tests: Application Submission → Reviewer Assignment → Review Submission → Aggregation → Decision
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Import hooks AFTER mocks are declared (Vitest resolves them using the mock)
import {
  useAssignReviewers,
  useSubmitReview,
  useReviewAggregation,
  useApplicationReviewScores,
  calculateDecision,
} from '../useReviewerAssignment';

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

describe('Application Review Workflow - Integration Tests', () => {
  let testApplicationId: string;
  let testProjectId: number;
  let testCategoryId: number;
  let testReviewerIds: string[] = [];
  let testAssignmentIds: string[] = [];
  let testApplicantId: string;
  let adminUserId: string;
  const testTimestamp = Date.now();

  beforeAll(async () => {
    if (!supabaseAdmin) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set, skipping integration tests');
      return;
    }

    // 1. Create a dedicated test category to avoid picking unrelated reviewers
    const { data: newCategory, error: categoryError } = await supabaseAdmin
      .from('categories')
      .insert({
        name: `IntTest Review Category ${testTimestamp}`,
        slug: `inttest-review-${testTimestamp}`,
        description: 'Integration test category for review workflow',
        is_active: true,
      })
      .select('id')
      .single();

    if (categoryError || !newCategory) {
      throw new Error(`Failed to create category: ${categoryError?.message}`);
    }
    testCategoryId = newCategory.id;

    // 2. Create test project
    const { data: projectData, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        title: `IntTest Review Workflow Project ${testTimestamp}`,
        description: 'Integration test project for review workflow',
        category_id: testCategoryId,
        status: 'open',
        location: 'Ghana',
        funding_amount: '$50,000',
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        featured: false,
      })
      .select('id')
      .single();

    if (projectError || !projectData) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }
    testProjectId = projectData.id;

    // 3. Create test applicant
    const applicantEmail = `int-review-applicant-${testTimestamp}@maali.test`;
    const { data: applicantData, error: applicantError } = await supabaseAdmin.auth.admin.createUser({
      email: applicantEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (applicantError || !applicantData?.user) {
      throw new Error(`Failed to create test applicant: ${applicantError?.message}`);
    }
    testApplicantId = applicantData.user.id;

    await supabaseAdmin.from('profiles').upsert(
      {
        user_id: testApplicantId,
        first_name: 'Test',
        last_name: 'Applicant',
        role: 'applicant',
      },
      { onConflict: 'user_id' }
    );

    // 4. Create test application
    const { data: applicationData, error: applicationError } = await (supabaseAdmin
      .from('applications') as any)
      .insert({
        user_id: testApplicantId,
        project_id: testProjectId,
        contact_email: applicantEmail,
        organization_name: 'Test Organization',
        country_of_residence: 'Ghana',
        project_title: 'Test Application',
        project_summary: 'Test project summary',
        status: 'pending',
        is_draft: false,
      })
      .select('id')
      .single();

    if (applicationError || !applicationData) {
      throw new Error(`Failed to create test application: ${applicationError?.message}`);
    }
    testApplicationId = applicationData.id;

    // 5. Create test reviewers (2 reviewers)
    const reviewerEmails = [
      `int-reviewer1-${testTimestamp}@maali.test`,
      `int-reviewer2-${testTimestamp}@maali.test`,
    ];

    for (const email of reviewerEmails) {
      const { data: reviewerData, error: reviewerError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'TestPassword123!',
        email_confirm: true,
      });

      if (reviewerError || !reviewerData?.user) {
        throw new Error(`Failed to create test reviewer: ${reviewerError?.message}`);
      }

      const reviewerId = reviewerData.user.id;
      testReviewerIds.push(reviewerId);

      // Create profile
      await supabaseAdmin.from('profiles').upsert(
        {
          user_id: reviewerId,
          first_name: 'Test',
          last_name: 'Reviewer',
          role: 'reviewer',
        },
        { onConflict: 'user_id' }
      );

      // Assign reviewer to category
      await supabaseAdmin.from('reviewer_categories').insert({
        reviewer_id: reviewerId,
        category_id: testCategoryId,
      });
    }

    // 6. Create admin user for assignment
    const adminEmail = `int-admin-review-${testTimestamp}@maali.test`;
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (adminError || !adminData?.user) {
      throw new Error(`Failed to create test admin: ${adminError?.message}`);
    }
    adminUserId = adminData.user.id;

    await supabaseAdmin.from('profiles').upsert(
      {
        user_id: adminUserId,
        first_name: 'Test',
        last_name: 'Admin',
        role: 'admin',
      },
      { onConflict: 'user_id' }
    );

    // 7. Sign in as admin for assignment
    const { error: signInError } = await shared.realClient!.auth.signInWithPassword({
      email: adminEmail,
      password: 'TestPassword123!',
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }
  }, 30000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    // Clean up review scores
    if (testApplicationId) {
      await supabaseAdmin
        .from('review_scores')
        .delete()
        .eq('application_id', testApplicationId);
    }

    // Clean up assignments
    if (testAssignmentIds.length > 0) {
      await supabaseAdmin
        .from('application_assignments')
        .delete()
        .in('id', testAssignmentIds);
    } else if (testApplicationId) {
      await supabaseAdmin
        .from('application_assignments')
        .delete()
        .eq('application_id', testApplicationId);
    }

    // Clean up application
    if (testApplicationId) {
      await supabaseAdmin
        .from('applications')
        .delete()
        .eq('id', testApplicationId);
    }

    // Clean up project
    if (testProjectId) {
      await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', testProjectId);
    }

    // Clean up category
    if (testCategoryId) {
      await supabaseAdmin
        .from('categories')
        .delete()
        .eq('id', testCategoryId);
    }

    // Clean up reviewer categories
    for (const reviewerId of testReviewerIds) {
      await supabaseAdmin
        .from('reviewer_categories')
        .delete()
        .eq('reviewer_id', reviewerId);
    }

    // Clean up users
    for (const userId of [...testReviewerIds, testApplicantId, adminUserId]) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Sign out
    await shared.realClient!.auth.signOut();
  }, 30000);

  describe('Complete Review Workflow', () => {
    it('should complete full review workflow: assignment → reviews → aggregation → decision', async () => {
      // Step 1: Assign reviewers using RPC
      const { result: assignResult } = renderHook(() => useAssignReviewers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        assignResult.current.mutate({
          applicationId: testApplicationId,
          numReviewers: 2,
        });
      });

      await waitFor(
        () => {
          expect(assignResult.current.isSuccess).toBe(true);
        },
        { timeout: 15000 }
      );

      // Verify assignments were created
      const { data: assignments, error: assignError } = await shared.realClient!
        .from('application_assignments')
        .select('*')
        .eq('application_id', testApplicationId);

      expect(assignError).toBeNull();
      expect(assignments).toBeDefined();
      expect(assignments!.length).toBeGreaterThanOrEqual(2);

      const reviewer1Id = testReviewerIds[0];
      const reviewer2Id = testReviewerIds[1];

      // Store assignment IDs
      testAssignmentIds = assignments!.map(a => a.id);
      
      // Helper to map reviewer -> assignment dynamically (avoids relying on array order)
      const getAssignmentIdForReviewer = (reviewerId: string) =>
        assignments!.find((a) => a.reviewer_id === reviewerId)?.id as string;

      // Verify reviewers were assigned
      const assignedReviewerIds = assignments!.map(a => a.reviewer_id);
      expect(assignedReviewerIds.length).toBeGreaterThanOrEqual(2);
      expect(getAssignmentIdForReviewer(reviewer1Id)).toBeDefined();
      expect(getAssignmentIdForReviewer(reviewer2Id)).toBeDefined();

      // Step 2: Submit reviews as each reviewer
      const reviewScores: Array<{
        reviewerId: string;
        assignmentId: string;
        scores: Record<string, number>;
        comments: string;
        recommendation: 'approve' | 'reject' | 'request_info';
      }> = [
        {
          reviewerId: reviewer1Id,
          assignmentId: getAssignmentIdForReviewer(reviewer1Id),
          scores: { innovation: 9, feasibility: 8, impact: 9 },
          comments: 'Strong proposal with clear market potential',
          recommendation: 'approve',
        },
        {
          reviewerId: reviewer2Id,
          assignmentId: getAssignmentIdForReviewer(reviewer2Id),
          scores: { innovation: 8, feasibility: 8, impact: 9 },
          comments: 'Good potential, well-structured plan',
          recommendation: 'approve',
        },
      ];

      // Sign in as first reviewer
      const reviewer1Email = `int-reviewer1-${testTimestamp}@maali.test`;
      await shared.realClient!.auth.signInWithPassword({
        email: reviewer1Email,
        password: 'TestPassword123!',
      });

      const { result: review1Result } = renderHook(() => useSubmitReview(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        review1Result.current.mutate({
          applicationId: testApplicationId,
          reviewerId: reviewScores[0].reviewerId,
          assignmentId: getAssignmentIdForReviewer(reviewScores[0].reviewerId),
          scores: reviewScores[0].scores,
          comments: reviewScores[0].comments,
          recommendation: reviewScores[0].recommendation,
        });
      });

      await waitFor(
        () => {
          if (review1Result.current.isError) {
            // Helpful debug output when this integration test flakes
            // eslint-disable-next-line no-console
            console.log("REVIEW 1 ERROR:", review1Result.current.error);
          }
          expect(review1Result.current.isSuccess).toBe(true);
        },
        { timeout: 15000 }
      );

      expect(review1Result.current.data).toBeDefined();
      expect(review1Result.current.data?.recommendation).toBe('approve');
      expect(review1Result.current.data?.overall_score).toBeDefined();
      expect(review1Result.current.data?.overall_score).toBeGreaterThan(0);

      // Sign in as second reviewer
      const reviewer2Email = `int-reviewer2-${testTimestamp}@maali.test`;
      await shared.realClient!.auth.signInWithPassword({
        email: reviewer2Email,
        password: 'TestPassword123!',
      });

      const { result: review2Result } = renderHook(() => useSubmitReview(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        review2Result.current.mutate({
          applicationId: testApplicationId,
          reviewerId: reviewScores[1].reviewerId,
          assignmentId: getAssignmentIdForReviewer(reviewScores[1].reviewerId),
          scores: reviewScores[1].scores,
          comments: reviewScores[1].comments,
          recommendation: reviewScores[1].recommendation,
        });
      });

      await waitFor(
        () => {
          if (review2Result.current.isError) {
            // Helpful debug output when this integration test flakes
            // eslint-disable-next-line no-console
            console.log("REVIEW 2 ERROR:", review2Result.current.error);
          }
          expect(review2Result.current.isSuccess).toBe(true);
        },
        { timeout: 15000 }
      );

      expect(review2Result.current.data).toBeDefined();
      expect(review2Result.current.data?.recommendation).toBe('approve');

      // Step 3: Test aggregation using RPC
      // Sign in as admin to view aggregation
      const adminEmail = `int-admin-review-${testTimestamp}@maali.test`;
      await shared.realClient!.auth.signInWithPassword({
        email: adminEmail,
        password: 'TestPassword123!',
      });

      const { result: aggregationResult } = renderHook(
        () => useReviewAggregation(testApplicationId),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(aggregationResult.current.isSuccess).toBe(true);
        },
        { timeout: 15000 }
      );

      expect(aggregationResult.current.data).toBeDefined();
      expect(aggregationResult.current.data?.total_reviews).toBeGreaterThanOrEqual(2);
      expect(aggregationResult.current.data?.average_score).toBeGreaterThan(0);
      expect(aggregationResult.current.data?.recommendations.approve).toBeGreaterThanOrEqual(2);

      // Step 4: Test decision calculation with real aggregation
      if (aggregationResult.current.data) {
        const decision = calculateDecision(aggregationResult.current.data, 2);

        expect(decision).not.toBeNull();
        expect(decision?.recommendedDecision).toBeDefined();
        expect(decision?.confidence).toBeGreaterThanOrEqual(0);
        expect(decision?.reasoning).toBeDefined();
        expect(Array.isArray(decision?.reasoning)).toBe(true);
      }

      // Step 5: Verify review scores are accessible
      const { result: scoresResult } = renderHook(
        () => useApplicationReviewScores(testApplicationId),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(
        () => {
          expect(scoresResult.current.isSuccess).toBe(true);
        },
        { timeout: 15000 }
      );

      expect(scoresResult.current.data).toBeDefined();
      expect(scoresResult.current.data!.length).toBeGreaterThanOrEqual(2);
    }, 90000);

    it('should handle workflow with conflicting recommendations', async () => {
      // Create a new application for this test
      const { data: newAppData } = await supabaseAdmin!
        .from('applications')
        .insert({
          user_id: testApplicantId,
          project_id: testProjectId,
          contact_email: `int-conflict-${testTimestamp}@maali.test`,
          organization_name: 'Conflict Test Org',
          status: 'pending',
          is_draft: false,
        })
        .select('id')
        .single();

      if (!newAppData) return;
      const conflictAppId = newAppData.id;

      try {
        // Assign reviewers
        const { result: assignResult } = renderHook(() => useAssignReviewers(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          assignResult.current.mutate({
            applicationId: conflictAppId,
            numReviewers: 2,
          });
        });

        await waitFor(
          () => {
            expect(assignResult.current.isSuccess).toBe(true);
          },
          { timeout: 15000 }
        );

        const reviewer1Id = testReviewerIds[0];
        const reviewer2Id = testReviewerIds[1];

        // Get assignments
        const { data: assignments } = await shared.realClient!
          .from('application_assignments')
          .select('*')
          .eq('application_id', conflictAppId)
          .limit(2);

        if (!assignments || assignments.length < 2) return;

        const getAssignmentIdForReviewer = (reviewerId: string) =>
          assignments.find((a) => a.reviewer_id === reviewerId)?.id;

        expect(getAssignmentIdForReviewer(reviewer1Id)).toBeDefined();
        expect(getAssignmentIdForReviewer(reviewer2Id)).toBeDefined();

        // Submit conflicting reviews
        // Review 1: Approve
        await shared.realClient!.auth.signInWithPassword({
          email: `int-reviewer1-${testTimestamp}@maali.test`,
          password: 'TestPassword123!',
        });

        const { result: review1Result } = renderHook(() => useSubmitReview(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          review1Result.current.mutate({
            applicationId: conflictAppId,
            reviewerId: reviewer1Id,
            assignmentId: getAssignmentIdForReviewer(reviewer1Id)!,
            scores: { innovation: 9, feasibility: 9, impact: 9 },
            comments: 'Excellent proposal',
            recommendation: 'approve',
          });
        });

        await waitFor(
          () => {
            expect(review1Result.current.isSuccess).toBe(true);
          },
          { timeout: 15000 }
        );

        // Review 2: Reject
        await shared.realClient!.auth.signInWithPassword({
          email: `int-reviewer2-${testTimestamp}@maali.test`,
          password: 'TestPassword123!',
        });

        const { result: review2Result } = renderHook(() => useSubmitReview(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          review2Result.current.mutate({
            applicationId: conflictAppId,
            reviewerId: reviewer2Id,
            assignmentId: getAssignmentIdForReviewer(reviewer2Id)!,
            scores: { innovation: 3, feasibility: 2, impact: 3 },
            comments: 'Does not meet criteria',
            recommendation: 'reject',
          });
        });

        await waitFor(
          () => {
            expect(review2Result.current.isSuccess).toBe(true);
          },
          { timeout: 15000 }
        );

        // Test aggregation with conflicts
        await shared.realClient!.auth.signInWithPassword({
          email: `int-admin-review-${testTimestamp}@maali.test`,
          password: 'TestPassword123!',
        });

        const { result: aggResult } = renderHook(
          () => useReviewAggregation(conflictAppId),
          {
            wrapper: createWrapper(),
          }
        );

        await waitFor(
          () => {
            expect(aggResult.current.isSuccess).toBe(true);
          },
          { timeout: 15000 }
        );

        if (aggResult.current.data) {
          const decision = calculateDecision(aggResult.current.data, 2);

          expect(decision).not.toBeNull();
          // With conflicting recommendations, should recommend request_info or have lower confidence
          expect(['request_info', 'approve', 'reject']).toContain(decision?.recommendedDecision);
          expect(decision?.confidence).toBeLessThan(0.95); // Lower confidence due to conflict
        }

        // Clean up
        await supabaseAdmin!
          .from('review_scores')
          .delete()
          .eq('application_id', conflictAppId);
        await supabaseAdmin!
          .from('application_assignments')
          .delete()
          .eq('application_id', conflictAppId);
        await supabaseAdmin!
          .from('applications')
          .delete()
          .eq('id', conflictAppId);
      } catch (error) {
        // Clean up on error
        await supabaseAdmin!
          .from('review_scores')
          .delete()
          .eq('application_id', conflictAppId);
        await supabaseAdmin!
          .from('application_assignments')
          .delete()
          .eq('application_id', conflictAppId);
        await supabaseAdmin!
          .from('applications')
          .delete()
          .eq('id', conflictAppId);
      }
    }, 90000);
  });
});

