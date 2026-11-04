/**
 * Shared types for reviewer functionality
 */

export interface ReviewerCategory {
  id: string;
  reviewer_id: string;
  sector: string;
  created_at: string;
}

export interface ApplicationAssignment {
  id: string;
  application_id: string;
  reviewer_id: string;
  assigned_at: string;
  review_deadline?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'declined';
  reviewer?: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
}

export interface ReviewerConflict {
  id: string;
  reviewer_id: string;
  application_id: string;
  conflict_reason: string;
  created_at: string;
}

export interface ReviewScore {
  id: string;
  application_id: string;
  reviewer_id: string;
  assignment_id: string;
  scores: Record<string, number>;
  overall_score: number | null;
  comments: string | null;
  recommendation: 'approve' | 'reject' | 'request_info' | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  rubric_version_id?: string | null;
  reviewer?: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
}

export interface SystemRubric {
  id: string;
  version?: number;
  rubric: {
    criteria: Array<{
      name: string;
      weight: number;
      max_score: number;
      description?: string;
    }>;
  };
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewAggregation {
  total_reviews: number;
  pending_reviewers: number; // Count of assigned but not yet submitted reviewers
  average_score: number;
  score_variance: number | null; // Variance across all overall scores (null if < 2 reviews)
  per_criterion_averages: Record<string, number>; // Average score per criterion across all reviewers
  per_criterion_variances: Record<string, number>; // Variance per criterion
  recommendations: {
    approve: number;
    reject: number;
    request_info: number;
  };
  scores: ReviewScore[];
}

// Decision Engine Configuration
export interface DecisionEngineConfig {
  // Thresholds for 1-10 scale (adjust if using different scale)
  approveThreshold: number; // Default: 8.0 (equivalent to 4.0 on 1-5 scale)
  rejectThreshold: number; // Default: 5.0 (equivalent to 2.5 on 1-5 scale)
  varianceThreshold: number; // Default: 1.5 (equivalent to 0.75 on 1-5 scale)
  requireAllReviewers: boolean; // Require all reviewers to submit before decision
}

export interface DecisionEngineResult {
  recommendedDecision: 'approve' | 'reject' | 'request_info' | 'insufficient_reviews';
  confidence: number; // 0-1 scale, higher = more confident
  reasoning: string[];
  canAutoApprove: boolean; // Whether decision can be automatically applied
}

// Internal RPC response types
export type RpcAssignmentWithReviewerRow = {
  id: string;
  application_id: string;
  reviewer_id: string;
  assigned_at: string;
  status: string;
  reviewer_user_id: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
};

export type RpcReviewScoreWithReviewerRow = {
  id: string;
  application_id: string;
  reviewer_id: string;
  assignment_id: string;
  scores: any;
  overall_score: number | null;
  comments: string | null;
  recommendation: 'approve' | 'reject' | 'request_info' | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  reviewer_user_id: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
};









