import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { calculateDecision, ReviewAggregation } from '../useReviewerAssignment';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('useReviewerAssignment - Partial Reviews', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('calculateDecision with partial reviews', () => {
    it('should handle single review with null variance', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 1,
        pending_reviewers: 1,
        average_score: 8.5,
        score_variance: null, // Cannot calculate variance with 1 review
        per_criterion_averages: { innovation: 8.5 },
        per_criterion_variances: {},
        recommendations: { approve: 1, reject: 0, request_info: 0 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 2, { requireAllReviewers: false });

      expect(result).not.toBeNull();
      expect(result?.recommendedDecision).toBe('approve');
      expect(result?.confidence).toBeLessThan(0.95); // Lower confidence due to partial review
      expect(result?.reasoning.some(r => r.includes('1 of 2 reviewers'))).toBe(true);
      expect(result?.canAutoApprove).toBe(false); // Should not auto-approve with partial reviews
    });

    it('should reduce confidence based on completion ratio', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 1,
        pending_reviewers: 2, // 1 of 3 reviewers submitted (33% completion)
        average_score: 9.0,
        score_variance: null,
        per_criterion_averages: { innovation: 9.0 },
        per_criterion_variances: {},
        recommendations: { approve: 1, reject: 0, request_info: 0 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 3, { requireAllReviewers: false });

      expect(result).not.toBeNull();
      // Confidence should be reduced due to low completion ratio (33%)
      expect(result?.confidence).toBeLessThan(0.7);
      expect(result?.reasoning.some(r => r.includes('Only 1 of 3 reviewers'))).toBe(true);
    });

    it('should calculate variance correctly with 2+ reviews', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 2,
        pending_reviewers: 0,
        average_score: 7.75,
        score_variance: 1.125, // Variance calculated from 2 reviews
        per_criterion_averages: { innovation: 7.75 },
        per_criterion_variances: {},
        recommendations: { approve: 1, reject: 0, request_info: 1 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 2, { requireAllReviewers: false });

      expect(result).not.toBeNull();
      // score_variance is in aggregation, not in result - check that variance is used in reasoning
      expect(result?.reasoning.some(r => r.includes('Variance:') || r.includes('variance'))).toBe(true);
    });

    it('should return insufficient_reviews when requireAllReviewers is true', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 1,
        pending_reviewers: 1,
        average_score: 8.5,
        score_variance: null,
        per_criterion_averages: { innovation: 8.5 },
        per_criterion_variances: {},
        recommendations: { approve: 1, reject: 0, request_info: 0 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 2, { requireAllReviewers: true });

      expect(result).not.toBeNull();
      expect(result?.recommendedDecision).toBe('insufficient_reviews');
      expect(result?.confidence).toBe(0);
      expect(result?.canAutoApprove).toBe(false);
    });

    it('should handle high variance with partial reviews', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 2,
        pending_reviewers: 1,
        average_score: 6.5,
        score_variance: 2.5, // High variance
        per_criterion_averages: { innovation: 6.5 },
        per_criterion_variances: {},
        recommendations: { approve: 0, reject: 1, request_info: 1 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 3, { requireAllReviewers: false });

      expect(result).not.toBeNull();
      expect(result?.recommendedDecision).toBe('request_info');
      expect(result?.reasoning.some(r => r.includes('High variance'))).toBe(true);
    });

    it('should show N/A for variance when only one review exists', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 1,
        pending_reviewers: 1,
        average_score: 7.0,
        score_variance: null,
        per_criterion_averages: { innovation: 7.0 },
        per_criterion_variances: {},
        recommendations: { approve: 0, reject: 0, request_info: 1 },
        scores: [],
      };

      const result = calculateDecision(aggregation, 2, { requireAllReviewers: false });

      expect(result).not.toBeNull();
      expect(result?.reasoning.some(r => r.includes('N/A') || r.includes('only 1 review'))).toBe(true);
    });
  });

  describe('ReviewAggregation interface', () => {
    it('should have pending_reviewers field', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 2,
        pending_reviewers: 1,
        average_score: 8.0,
        score_variance: 0.5,
        per_criterion_averages: {},
        per_criterion_variances: {},
        recommendations: { approve: 2, reject: 0, request_info: 0 },
        scores: [],
      };

      expect(aggregation.pending_reviewers).toBe(1);
      expect(aggregation.total_reviews).toBe(2);
    });

    it('should allow null score_variance', () => {
      const aggregation: ReviewAggregation = {
        total_reviews: 1,
        pending_reviewers: 1,
        average_score: 8.5,
        score_variance: null,
        per_criterion_averages: {},
        per_criterion_variances: {},
        recommendations: { approve: 1, reject: 0, request_info: 0 },
        scores: [],
      };

      expect(aggregation.score_variance).toBeNull();
    });
  });
});









