/**
 * Hooks and utilities for review aggregation and decision engine
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewAggregation,
  DecisionEngineConfig,
  DecisionEngineResult,
  ApplicationAssignment,
  RpcReviewScoreWithReviewerRow,
} from '@/types/reviewer';

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

/**
 * Decision Engine: Rule-based automatic decision making
 * 
 * Rules:
 * - IF avg_score â‰¥ approveThreshold AND variance â‰¤ varianceThreshold â†’ APPROVE
 * - IF avg_score â‰¤ rejectThreshold â†’ REJECT
 * - IF variance > varianceThreshold â†’ REQUEST_MORE_INFO
 * - IF not all reviewers submitted â†’ INSUFFICIENT_REVIEWS
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

  // Rule 1: High variance indicates disagreement â†’ REQUEST_MORE_INFO
  if (score_variance !== null && score_variance > varianceThreshold) {
    recommendedDecision = 'request_info';
    confidence = 0.6;
    reasoning.push(
      `High variance (${score_variance.toFixed(2)}) indicates significant disagreement among reviewers.`,
      `Average score: ${average_score.toFixed(2)}/10`
    );
  }
  // Rule 2: Low average score â†’ REJECT
  else if (average_score <= rejectThreshold) {
    recommendedDecision = 'reject';
    confidence = Math.min(0.9, 0.5 + (rejectThreshold - average_score) / rejectThreshold);
    reasoning.push(
      `Average score (${average_score.toFixed(2)}/10) is below rejection threshold (${rejectThreshold}/10).`,
      `Reviewer recommendations: ${recommendations.approve} approve, ${recommendations.reject} reject, ${recommendations.request_info} request info`
    );
  }
  // Rule 3: High average + low variance â†’ APPROVE
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
  // Rule 4: Medium scores or mixed signals â†’ REQUEST_MORE_INFO
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









