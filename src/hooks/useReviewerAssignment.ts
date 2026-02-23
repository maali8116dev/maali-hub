import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ReviewerCategory {
  id: string;
  reviewer_id: string;
  category: string;
  created_at: string;
}

export interface ApplicationAssignment {
  id: string;
  application_id: string;
  reviewer_id: string;
  assigned_at: string;
  status: 'pending' | 'in_progress' | 'completed' | 'declined';
  reviewer?: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
}

type RpcAssignmentWithReviewerRow = {
  id: string;
  application_id: string;
  reviewer_id: string;
  assigned_at: string;
  status: string;
  reviewer_user_id: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
};

type RpcReviewScoreWithReviewerRow = {
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
}

export interface SystemRubric {
  id: string;
  rubric: {
    criteria: Array<{
      name: string;
      weight: number;
      max_score: number;
      description?: string;
    }>;
  };
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

// Assign reviewers to application (with workload balancing)
export const useAssignReviewers = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      numReviewers = 2 
    }: { 
      applicationId: string; 
      numReviewers?: number 
    }) => {
      const { data, error } = await supabase.rpc(
        'assign_reviewers_to_application',
        {
          p_application_id: applicationId,
          p_num_reviewers: numReviewers,
        }
      );
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['application-assignments', variables.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
    },
  });
};

// Get assignments for an application
export const useApplicationAssignments = (applicationId: string) => {
  return useQuery({
    queryKey: ['application-assignments', applicationId],
    queryFn: async () => {
      if (!applicationId) return [];

      // Server-side join (assignments + reviewer profile) to avoid extra round trips
      const { data, error } = await supabase.rpc(
        'get_application_assignments_with_reviewers' as any,
        { p_application_id: applicationId }
      );
      
      if (error) throw error;
      const rows = (data || []) as RpcAssignmentWithReviewerRow[];

      return rows.map((row) => ({
        id: row.id,
        application_id: row.application_id,
        reviewer_id: row.reviewer_id,
        assigned_at: row.assigned_at,
        status: (row.status as ApplicationAssignment['status']) || 'pending',
        reviewer: row.reviewer_user_id
          ? {
              user_id: row.reviewer_user_id,
              first_name: row.reviewer_first_name || '',
              last_name: row.reviewer_last_name || '',
            }
          : undefined,
      })) as ApplicationAssignment[];
    },
    enabled: !!applicationId,
  });
};

// Get reviewer's assignments (only for submitted applications, excluding drafts)
export const useReviewerAssignments = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-assignments', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      
      // Server-side join (assignment + application + category label) to avoid client joins
      const { data, error } = await supabase.rpc(
        'get_reviewer_assignments_with_application' as any,
        { p_reviewer_id: reviewerId }
      );
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!reviewerId,
  });
};

// Get reviewer workload (pending + in_progress count)
export const useReviewerWorkload = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-workload', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return 0;
      
      const { data, error } = await supabase.rpc(
        'get_reviewer_workload',
        { p_reviewer_id: reviewerId }
      );
      
      if (error) throw error;
      return data as number;
    },
    enabled: !!reviewerId,
  });
};

// Get reviewer categories
export const useReviewerCategories = (reviewerId?: string) => {
  return useQuery({
    queryKey: ['reviewer-categories', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      
      const { data, error } = await supabase
        .from('reviewer_categories')
        .select(`
          *,
          categories:category_id(name)
        `)
        .eq('reviewer_id', reviewerId);
      
      if (error) throw error;
      
      // Transform to include category name for backward compatibility and deduplicate
      const transformed = (data || []).map((item: any) => ({
        ...item,
        category: item.categories?.name || 'Unknown',
      })) as ReviewerCategory[];
      
      // Deduplicate by id to prevent duplicates
      const unique = Array.from(
        new Map(transformed.map(item => [item.id, item])).values()
      );
      
      // Sort by category name
      return unique.sort((a, b) => a.category.localeCompare(b.category));
    },
    enabled: !!reviewerId,
  });
};

// Get system rubric (single rubric for all applications)
export const useSystemRubric = () => {
  return useQuery({
    queryKey: ['system-rubric'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_rubric')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      
      return {
        ...data,
        rubric: data.rubric as SystemRubric['rubric'],
      } as SystemRubric;
    },
  });
};

// Submit review score
export const useSubmitReview = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      applicationId,
      reviewerId,
      assignmentId,
      scores,
      comments,
      recommendation,
    }: {
      applicationId: string;
      reviewerId: string;
      assignmentId: string;
      scores: Record<string, number>;
      comments?: string;
      recommendation: 'approve' | 'reject' | 'request_info';
    }) => {
      const { data, error } = await supabase
        .from('review_scores')
        .upsert({
          application_id: applicationId,
          reviewer_id: reviewerId,
          assignment_id: assignmentId,
          scores,
          comments: comments || null,
          recommendation,
          submitted_at: new Date().toISOString(),
        }, {
          onConflict: 'application_id,reviewer_id',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update assignment status
      await supabase
        .from('application_assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);
      
      return data as ReviewScore;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-scores', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['review-aggregation', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['application-assignments', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
    },
  });
};

// Get review scores for an application
export const useApplicationReviewScores = (applicationId: string) => {
  return useQuery({
    queryKey: ['review-scores', applicationId],
    queryFn: async () => {
      if (!applicationId) return [];

      // Server-side join (scores + reviewer profile) to avoid extra round trips
      const { data, error } = await supabase.rpc(
        'get_application_review_scores_with_reviewers' as any,
        { p_application_id: applicationId }
      );
      
      if (error) throw error;
      const rows = (data || []) as RpcReviewScoreWithReviewerRow[];

      return rows.map((row) => ({
        id: row.id,
        application_id: row.application_id,
        reviewer_id: row.reviewer_id,
        assignment_id: row.assignment_id,
        scores: (row.scores || {}) as Record<string, number>,
        overall_score: row.overall_score,
        comments: row.comments,
        recommendation: row.recommendation,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        reviewer: row.reviewer_user_id
          ? {
              user_id: row.reviewer_user_id,
              first_name: row.reviewer_first_name || '',
              last_name: row.reviewer_last_name || '',
            }
          : undefined,
      })) as ReviewScore[];
    },
    enabled: !!applicationId,
  });
};

// Get aggregated review results
export const useReviewAggregation = (applicationId: string, totalAssignedOverride?: number) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['review-aggregation', applicationId, totalAssignedOverride ?? 'auto'],
    queryFn: async () => {
      if (!applicationId) return null;

      // Fetch assignments via cache (if already loaded) to avoid extra network calls
      // Fallback to 0 if not present.
      const cachedAssignments = queryClient.getQueryData<ApplicationAssignment[]>([
        'application-assignments',
        applicationId,
      ]);
      const totalAssigned =
        typeof totalAssignedOverride === 'number'
          ? totalAssignedOverride
          : cachedAssignments?.length || 0;

      // Get all submitted review scores with reviewer info in one call
      const { data: scores, error } = await supabase.rpc(
        'get_application_review_scores_with_reviewers' as any,
        { p_application_id: applicationId }
      );
      
      if (error) throw error;
      
      const scoreRows = ((scores || []) as RpcReviewScoreWithReviewerRow[]).map((row) => ({
        ...row,
        reviewer: row.reviewer_user_id
          ? {
              user_id: row.reviewer_user_id,
              first_name: row.reviewer_first_name || '',
              last_name: row.reviewer_last_name || '',
            }
          : undefined,
      })) as any[];

      if (!scoreRows || scoreRows.length === 0) {
        // Return null if no reviews, but we can still track pending
        return totalAssigned > 0 ? {
          total_reviews: 0,
          pending_reviewers: totalAssigned,
          average_score: 0,
          score_variance: null,
          per_criterion_averages: {},
          per_criterion_variances: {},
          recommendations: { approve: 0, reject: 0, request_info: 0 },
          scores: [],
        } : null;
      }
      
      // Calculate pending reviewers (assigned but not yet submitted)
      const submittedReviewerIds = new Set(scoreRows.map(s => s.reviewer_id));
      const pendingReviewers = Math.max(0, totalAssigned - submittedReviewerIds.size);
      
      // Calculate overall average score
      const overallScores = scoreRows.map(s => s.overall_score || 0).filter(s => s > 0);
      const averageScore = overallScores.length > 0
        ? overallScores.reduce((sum, s) => sum + s, 0) / overallScores.length
        : 0;

      // Calculate variance of overall scores (null if < 2 reviews)
      const scoreVariance = overallScores.length > 1
        ? overallScores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / overallScores.length
        : null;

      // Collect all criterion names from all scores
      const allCriteria = new Set<string>();
      scoreRows.forEach(score => {
        if (score.scores && typeof score.scores === 'object') {
          Object.keys(score.scores).forEach(key => allCriteria.add(key));
        }
      });

      // Calculate per-criterion averages and variances
      const perCriterionAverages: Record<string, number> = {};
      const perCriterionVariances: Record<string, number> = {};

      allCriteria.forEach(criterion => {
        // Get all scores for this criterion across all reviewers
        const criterionScores = scoreRows
          .map(score => {
            if (score.scores && typeof score.scores === 'object') {
              const value = score.scores[criterion];
              return typeof value === 'number' ? value : null;
            }
            return null;
          })
          .filter((score): score is number => score !== null);

        if (criterionScores.length > 0) {
          // Calculate average for this criterion
          const criterionAvg = criterionScores.reduce((sum, s) => sum + s, 0) / criterionScores.length;
          perCriterionAverages[criterion] = criterionAvg;

          // Calculate variance for this criterion
          const criterionVariance = criterionScores.length > 1
            ? criterionScores.reduce((sum, score) => sum + Math.pow(score - criterionAvg, 2), 0) / criterionScores.length
            : 0;
          perCriterionVariances[criterion] = criterionVariance;
        }
      });

      // Aggregate scores
      const aggregated: ReviewAggregation = {
        total_reviews: scoreRows.length,
        pending_reviewers: pendingReviewers,
        average_score: averageScore,
        score_variance: scoreVariance,
        per_criterion_averages: perCriterionAverages,
        per_criterion_variances: perCriterionVariances,
        recommendations: {
          approve: scoreRows.filter(s => s.recommendation === 'approve').length,
          reject: scoreRows.filter(s => s.recommendation === 'reject').length,
          request_info: scoreRows.filter(s => s.recommendation === 'request_info').length,
        },
        scores: scoreRows as any[], // Include reviewer profile data
      };
      
      return aggregated;
    },
    enabled: !!applicationId,
  });
};

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

/**
 * Decision Engine: Rule-based automatic decision making
 * 
 * Rules:
 * - IF avg_score ≥ approveThreshold AND variance ≤ varianceThreshold → APPROVE
 * - IF avg_score ≤ rejectThreshold → REJECT
 * - IF variance > varianceThreshold → REQUEST_MORE_INFO
 * - IF not all reviewers submitted → INSUFFICIENT_REVIEWS
 */
export function calculateDecision(
  aggregation: ReviewAggregation | null,
  expectedReviewers: number = 2,
  config: Partial<DecisionEngineConfig> = {}
): DecisionEngineResult | null {
  if (!aggregation || aggregation.total_reviews === 0) {
    return null;
  }

  const {
    approveThreshold = 8.0, // 4.0 on 1-5 scale
    rejectThreshold = 5.0,  // 2.5 on 1-5 scale
    varianceThreshold = 1.5, // 0.75 on 1-5 scale (scaled up)
    requireAllReviewers = false,
  } = config;

  const reasoning: string[] = [];
  let recommendedDecision: 'approve' | 'reject' | 'request_info' | 'insufficient_reviews' = 'request_info';
  let confidence = 0.5; // Default medium confidence

  // Check if all reviewers have submitted
  if (requireAllReviewers && aggregation.total_reviews < expectedReviewers) {
    return {
      recommendedDecision: 'insufficient_reviews',
      confidence: 0,
      reasoning: [`Only ${aggregation.total_reviews} of ${expectedReviewers} reviewers have submitted their reviews.`],
      canAutoApprove: false,
    };
  }

  const { average_score, score_variance, recommendations, pending_reviewers, total_reviews } = aggregation;

  // Calculate completion ratio and adjust confidence accordingly
  const completionRatio = expectedReviewers > 0 ? total_reviews / expectedReviewers : 1.0;
  if (completionRatio < 1.0 && pending_reviewers > 0) {
    reasoning.push(`Only ${total_reviews} of ${expectedReviewers} reviewers have submitted (${pending_reviewers} pending).`);
  }

  // Rule 1: High variance indicates disagreement → REQUEST_MORE_INFO
  if (score_variance !== null && score_variance > varianceThreshold) {
    recommendedDecision = 'request_info';
    confidence = 0.6;
    reasoning.push(
      `High variance (${score_variance.toFixed(2)}) indicates significant disagreement among reviewers.`,
      `Average score: ${average_score.toFixed(2)}/10`
    );
  }
  // Rule 2: Low average score → REJECT
  else if (average_score <= rejectThreshold) {
    recommendedDecision = 'reject';
    confidence = Math.min(0.9, 0.5 + (rejectThreshold - average_score) / rejectThreshold);
    reasoning.push(
      `Average score (${average_score.toFixed(2)}/10) is below rejection threshold (${rejectThreshold}/10).`,
      `Reviewer recommendations: ${recommendations.approve} approve, ${recommendations.reject} reject, ${recommendations.request_info} request info`
    );
  }
  // Rule 3: High average + low variance → APPROVE
  else if (average_score >= approveThreshold && (score_variance === null || score_variance <= varianceThreshold)) {
    recommendedDecision = 'approve';
    confidence = Math.min(0.95, 0.7 + (average_score - approveThreshold) / (10 - approveThreshold));
    if (score_variance !== null) {
      reasoning.push(
        `Average score (${average_score.toFixed(2)}/10) meets approval threshold (${approveThreshold}/10).`,
        `Low variance (${score_variance.toFixed(2)}) indicates reviewer agreement.`
      );
    } else {
      reasoning.push(
        `Average score (${average_score.toFixed(2)}/10) meets approval threshold (${approveThreshold}/10).`,
        `Only one review submitted so far - variance cannot be calculated.`
      );
    }
    reasoning.push(
      `Reviewer recommendations: ${recommendations.approve} approve, ${recommendations.reject} reject, ${recommendations.request_info} request info`
    );
  }
  // Rule 4: Medium scores or mixed signals → REQUEST_MORE_INFO
  else {
    recommendedDecision = 'request_info';
    confidence = 0.5;
    reasoning.push(
      `Average score (${average_score.toFixed(2)}/10) is between thresholds.`,
      score_variance !== null 
        ? `Variance: ${score_variance.toFixed(2)}`
        : `Variance: N/A (only ${total_reviews} review${total_reviews > 1 ? 's' : ''} submitted)`,
      `Reviewer recommendations: ${recommendations.approve} approve, ${recommendations.reject} reject, ${recommendations.request_info} request info`,
      `Human review recommended for final decision.`
    );
  }

  // Adjust confidence based on reviewer consensus
  const totalRecommendations = recommendations.approve + recommendations.reject + recommendations.request_info;
  if (totalRecommendations > 0) {
    const consensusRatio = Math.max(
      recommendations.approve / totalRecommendations,
      recommendations.reject / totalRecommendations
    );
    confidence = confidence * 0.7 + (consensusRatio * 0.3); // Blend score-based and consensus-based confidence
  }

  // Reduce confidence based on completion ratio (partial reviews = lower confidence)
  if (completionRatio < 1.0) {
    confidence = confidence * (0.5 + 0.5 * completionRatio); // Scale confidence by completion
  }

  // Determine if can auto-approve (only for high-confidence approve decisions)
  const canAutoApprove = recommendedDecision === 'approve' && confidence >= 0.85;

  return {
    recommendedDecision,
    confidence,
    reasoning,
    canAutoApprove,
  };
}

/**
 * Hook to get decision engine recommendation for an application
 */
export const useDecisionEngine = (
  applicationId: string,
  expectedReviewers: number = 2,
  config?: Partial<DecisionEngineConfig>
) => {
  const { data: aggregation } = useReviewAggregation(applicationId, expectedReviewers);
  
  return useQuery({
    queryKey: ['decision-engine', applicationId, expectedReviewers, config],
    queryFn: () => {
      return calculateDecision(aggregation || null, expectedReviewers, config);
    },
    enabled: !!applicationId && !!aggregation,
  });
};

// Update assignment status
export const useUpdateAssignmentStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'declined';
    }) => {
      const { data, error } = await supabase
        .from('application_assignments')
        .update({ status })
        .eq('id', assignmentId)
        .select()
        .single();
      
      if (error) throw error;
      return data as ApplicationAssignment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['application-assignments', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
    },
  });
};

// Add conflict of interest
export const useAddConflict = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      reviewerId,
      applicationId,
      conflictReason,
    }: {
      reviewerId: string;
      applicationId: string;
      conflictReason: string;
    }) => {
      const { data, error } = await supabase
        .from('reviewer_conflicts')
        .insert({
          reviewer_id: reviewerId,
          application_id: applicationId,
          conflict_reason: conflictReason,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ReviewerConflict;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewer-conflicts'] });
    },
  });
};

