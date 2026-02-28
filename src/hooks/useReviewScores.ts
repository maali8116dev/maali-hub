/**
 * Hooks for managing review scores
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewScore,
  RpcReviewScoreWithReviewerRow,
} from '@/types/reviewer';

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
      rubricVersionId,
    }: {
      applicationId: string;
      reviewerId: string;
      assignmentId: string;
      scores: Record<string, number>;
      comments?: string;
      recommendation: 'approve' | 'reject' | 'request_info';
      rubricVersionId?: string;
    }) => {
      // Get active rubric version if not provided
      let activeRubricVersionId = rubricVersionId;
      if (!activeRubricVersionId) {
        const { data: activeVersion, error: versionError } = await supabase
          .from('rubric_versions' as any)
          .select('id')
          .eq('is_active', true)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (versionError) throw versionError;
        activeRubricVersionId = (activeVersion as any)?.id || null;
      }
      
      const { data, error } = await supabase
        .from('review_scores')
        .upsert({
          application_id: applicationId,
          reviewer_id: reviewerId,
          assignment_id: assignmentId,
          scores,
          comments: comments || null,
          recommendation,
          rubric_version_id: activeRubricVersionId,
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
        rubric_version_id: undefined, // Add if RPC returns it
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

