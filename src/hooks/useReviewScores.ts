/**
 * Hooks for managing review scores
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewScore,
  RpcReviewScoreWithReviewerRow,
} from '@/types/reviewer';
import { logActivityDirect } from './useActivityLogger';

// Save review draft (pause and continue later)
export const useSaveReviewDraft = () => {
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
        .upsert(
          {
            application_id: applicationId,
            reviewer_id: reviewerId,
            assignment_id: assignmentId,
            scores,
            comments: comments || null,
            recommendation,
            submitted_at: null,
          },
          {
            onConflict: 'application_id,reviewer_id',
          }
        )
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('application_assignments')
        .update({ status: 'in_progress' })
        .eq('id', assignmentId);

      return data as ReviewScore;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-scores', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['application-assignments', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-applications'] });
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
      // Get reviewer profile information for activity log
      const { data: reviewerProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, role')
        .eq('user_id', reviewerId)
        .single();

      // Get application and opportunity information for activity log
      const { data: application } = await supabase
        .from('applications')
        .select('opportunity_id, opportunities:opportunity_id(title)')
        .eq('id', applicationId)
        .single();

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
      
      // Calculate overall score from saved data or scores
      const overallScore = (data as any).overall_score || 
        (Object.values(scores).length > 0
          ? Object.values(scores).reduce((sum: number, score: any) => sum + score, 0) / Object.values(scores).length
          : 0);
      
      // Log activity with reviewer details
      const reviewerName = reviewerProfile
        ? `${reviewerProfile.first_name || ''} ${reviewerProfile.last_name || ''}`.trim() || 'Unknown Reviewer'
        : 'Unknown Reviewer';

      await logActivityDirect({
        userId: reviewerId,
        actionType: 'review',
        entityType: 'application',
        entityId: applicationId,
        description: `Review submitted for application ${applicationId} by ${reviewerName}`,
        metadata: {
          reviewer_id: reviewerId,
          reviewer_name: reviewerName,
          reviewer_role: reviewerProfile?.role || 'reviewer',
          application_id: applicationId,
          opportunity_id: application?.opportunity_id || null,
          opportunity_title: (application?.opportunities as any)?.title || null,
          overall_score: typeof overallScore === 'number' ? overallScore.toFixed(2) : String(overallScore || '0.00'),
          recommendation,
          scores,
          has_comments: !!comments,
          comments_length: comments?.length || 0,
        },
      });
      
      return data as ReviewScore;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['review-scores', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['review-aggregation', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['application-assignments', data.application_id] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-workload'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-applications'] });
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









