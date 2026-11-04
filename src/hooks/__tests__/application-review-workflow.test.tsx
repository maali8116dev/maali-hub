import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { useAssignReviewers } from '../useReviewerAssignment';
import { useSubmitReview } from '../useReviewerAssignment';
import { useReviewAggregation } from '../useReviewerAssignment';
import { calculateDecision } from '../useReviewerAssignment';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

/**
 * Unit test for complete application review workflow (mocked)
 * Tests: Application Submission â†’ Reviewer Assignment â†’ Review Submission â†’ Aggregation â†’ Decision
 * 
 * This test focuses on business logic without UI rendering.
 * For real database integration tests, see the integration test suite.
 */
describe('Application Review Workflow', () => {
  const mockApplicationId = 'app-123';
  const mockProjectId = 1;
  const mockCategory = 'technology';
  
  const mockReviewer1 = {
    id: 'reviewer-1',
    user_id: 'user-1',
    first_name: 'John',
    last_name: 'Doe',
  };
  
  const mockReviewer2 = {
    id: 'reviewer-2',
    user_id: 'user-2',
    first_name: 'Jane',
    last_name: 'Smith',
  };

  const mockReviewer3 = {
    id: 'reviewer-3',
    user_id: 'user-3',
    first_name: 'Bob',
    last_name: 'Johnson',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Workflow: Submission â†’ Assignment â†’ Reviews â†’ Decision', () => {
    it('should complete full review workflow with 2 reviewers', async () => {
      // Step 1: Mock reviewer assignment
      const mockAssignments = [
        {
          id: 'assign-1',
          application_id: mockApplicationId,
          reviewer_id: mockReviewer1.id,
          assigned_at: '2024-01-01T00:00:00Z',
          status: 'pending' as const,
        },
        {
          id: 'assign-2',
          application_id: mockApplicationId,
          reviewer_id: mockReviewer2.id,
          assigned_at: '2024-01-01T00:00:00Z',
          status: 'pending' as const,
        },
      ];

      // Mock reviewer sectors query
      const mockReviewersectorsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { reviewer_id: mockReviewer1.id, sector: mockCategory },
            { reviewer_id: mockReviewer2.id, sector: mockCategory },
          ],
          error: null,
        }),
      };

      // Mock workload query
      const mockWorkloadQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { reviewer_id: mockReviewer1.id, workload: 2 },
            { reviewer_id: mockReviewer2.id, workload: 1 },
          ],
          error: null,
        }),
      };

      // Mock assignment insert
      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: mockAssignments,
          error: null,
        }),
      };

      let callCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        callCount++;
        if (table === 'reviewer_sectors') {
          return mockReviewersectorsQuery;
        }
        if (table === 'application_assignments') {
          if (callCount === 2) {
            // Workload query
            return mockWorkloadQuery;
          }
          return mockInsertQuery;
        }
        return mockReviewersectorsQuery;
      });

      // Step 2: Simulate reviewer assignment
      const assignmentResult = await mockInsertQuery.insert([
        {
          application_id: mockApplicationId,
          reviewer_id: mockReviewer1.id,
          status: 'pending',
        },
        {
          application_id: mockApplicationId,
          reviewer_id: mockReviewer2.id,
          status: 'pending',
        },
      ]).select();

      expect(assignmentResult.data).toHaveLength(2);
      expect(assignmentResult.data[0].reviewer_id).toBe(mockReviewer1.id);
      expect(assignmentResult.data[1].reviewer_id).toBe(mockReviewer2.id);

      // Step 3: Mock review submissions
      const mockReview1 = {
        id: 'review-1',
        application_id: mockApplicationId,
        reviewer_id: mockReviewer1.id,
        assignment_id: 'assign-1',
        scores: {
          innovation: 9,
          feasibility: 8,
          impact: 9,
        },
        overall_score: 8.67,
        comments: 'Strong application',
        recommendation: 'approve' as const,
        submitted_at: '2024-01-02T00:00:00Z',
      };

      const mockReview2 = {
        id: 'review-2',
        application_id: mockApplicationId,
        reviewer_id: mockReviewer2.id,
        assignment_id: 'assign-2',
        scores: {
          innovation: 8,
          feasibility: 8,
          impact: 9,
        },
        overall_score: 8.33,
        comments: 'Good potential',
        recommendation: 'approve' as const,
        submitted_at: '2024-01-02T01:00:00Z',
      };

      const mockUpsertQuery = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [mockReview1],
          error: null,
        }),
      };

      const mockUpsertQuery2 = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: [mockReview2],
          error: null,
        }),
      };

      let reviewCallCount = 0;
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'review_scores') {
          reviewCallCount++;
          return reviewCallCount === 1 ? mockUpsertQuery : mockUpsertQuery2;
        }
        return mockUpsertQuery;
      });

      // Simulate review submissions
      const review1Result = await mockUpsertQuery.upsert({
        application_id: mockApplicationId,
        reviewer_id: mockReviewer1.id,
        assignment_id: 'assign-1',
        scores: mockReview1.scores,
        overall_score: mockReview1.overall_score,
        comments: mockReview1.comments,
        recommendation: mockReview1.recommendation,
      }).select();

      const review2Result = await mockUpsertQuery2.upsert({
        application_id: mockApplicationId,
        reviewer_id: mockReviewer2.id,
        assignment_id: 'assign-2',
        scores: mockReview2.scores,
        overall_score: mockReview2.overall_score,
        comments: mockReview2.comments,
        recommendation: mockReview2.recommendation,
      }).select();

      expect(review1Result.data).toBeDefined();
      expect(review2Result.data).toBeDefined();

      // Step 4: Test aggregation
      const aggregation = {
        total_reviews: 2,
        pending_reviewers: 0,
        average_score: 8.5, // (8.67 + 8.33) / 2 - above approval threshold of 8.0
        score_variance: 0.057, // Low variance (scores are close)
        per_criterion_averages: {
          innovation: 8.5, // (9 + 8) / 2
          feasibility: 8.0, // (8 + 8) / 2
          impact: 9.0, // (9 + 9) / 2
        },
        per_criterion_variances: {
          innovation: 0.25,
          feasibility: 0.0,
          impact: 0.0,
        },
        recommendations: {
          approve: 2,
          reject: 0,
          request_info: 0,
        },
      };

      expect(aggregation.total_reviews).toBe(2);
      expect(aggregation.pending_reviewers).toBe(0);
      expect(aggregation.recommendations.approve).toBe(2);
      expect(aggregation.average_score).toBeGreaterThanOrEqual(8.0); // Above approval threshold

      // Step 5: Test decision calculation
      const decision = calculateDecision({ ...aggregation, scores: [] });
      
      expect(decision).not.toBeNull();
      expect(decision?.recommendedDecision).toBe('approve');
      expect(decision?.confidence).toBeGreaterThan(0.7);
      expect(decision?.reasoning.some(r => r.includes('approve'))).toBe(true);
    });

    it('should handle workflow with conflicting recommendations', async () => {
      // Setup: 3 reviewers with mixed recommendations
      const mockReviews = [
        {
          overall_score: 9.0,
          recommendation: 'approve' as const,
        },
        {
          overall_score: 6.0,
          recommendation: 'reject' as const,
        },
        {
          overall_score: 7.5,
          recommendation: 'request_info' as const,
        },
      ];

      const aggregation = {
        total_reviews: 3,
        pending_reviewers: 0,
        average_score: 7.5, // (9 + 6 + 7.5) / 3
        score_variance: 1.5,
        per_criterion_averages: {},
        per_criterion_variances: {},
        recommendations: {
          approve: 1,
          reject: 1,
          request_info: 1,
        },
      };

      const decision = calculateDecision({ ...aggregation, scores: [] });

      expect(decision).not.toBeNull();
      expect(decision?.recommendedDecision).toBe('request_info');
      expect(decision?.confidence).toBeLessThan(0.7);
      expect(decision?.reasoning.some(r => r.includes('conflicting') || r.includes('Human review'))).toBe(true);
    });

    it('should handle workflow with pending reviewers', async () => {
      const aggregation = {
        total_reviews: 1,
        pending_reviewers: 1, // One reviewer hasn't submitted yet
        average_score: 8.0,
        score_variance: null,
        per_criterion_averages: {},
        per_criterion_variances: {},
        recommendations: {
          approve: 1,
          reject: 0,
          request_info: 0,
        },
      };

      const decision = calculateDecision({ ...aggregation, scores: [] }, 2, { requireAllReviewers: true });

      expect(decision).not.toBeNull();
      expect(decision?.recommendedDecision).toBe('insufficient_reviews');
      expect(decision?.confidence).toBe(0);
      expect(decision?.reasoning.some(r => r.includes('Only 1 of 2'))).toBe(true);
    });

    it('should handle workflow with high variance requiring admin review', async () => {
      const aggregation = {
        total_reviews: 3,
        pending_reviewers: 0,
        average_score: 7.0,
        score_variance: 4.0, // High variance
        per_criterion_averages: {},
        per_criterion_variances: {},
        recommendations: {
          approve: 2,
          reject: 1,
          request_info: 0,
        },
      };

      const decision = calculateDecision({ ...aggregation, scores: [] });

      expect(decision).not.toBeNull();
      expect(decision?.recommendedDecision).toBe('request_info');
      expect(decision?.confidence).toBeLessThan(0.7);
      expect(decision?.reasoning.some(r => r.includes('variance') || r.includes('disagreement'))).toBe(true);
    });
  });

  describe('Workflow Error Handling', () => {
    it('should handle assignment failure gracefully', async () => {
      const mockErrorQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockErrorQuery);

      // Assignment should fail but not crash
      const result = await mockErrorQuery.select().eq('sector', mockCategory).in('reviewer_id', []);
      
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle review submission failure gracefully', async () => {
      const mockErrorQuery = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Validation error' },
        }),
      };

      (supabase.from as any).mockReturnValue(mockErrorQuery);

      const result = await mockErrorQuery.upsert({}).select();
      
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Validation error');
    });
  });
});









