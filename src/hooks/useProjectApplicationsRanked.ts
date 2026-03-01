import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RankedReviewerScore = {
  reviewer_id: string;
  reviewer_name: string;
  overall_score: number | null;
  recommendation: "approve" | "reject" | "request_info" | null;
  comments: string | null;
  submitted_at: string | null;
  scores: Record<string, number> | null;
};

export type RankedApplication = {
  application_id: string;
  applicant_name: string;
  applicant_email: string;
  submitted_at: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "draft" | string;
  average_score: number | null;
  score_variance: number | null;
  total_reviews: number;
  reviewer_scores: RankedReviewerScore[];
  recommendations: {
    approve: number;
    reject: number;
    request_info: number;
  };
  rank_position: number;
};

export function useProjectApplicationsRanked(projectId?: number) {
  return useQuery({
    queryKey: ["project-applications-ranked", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.rpc(
        "get_project_applications_ranked" as any,
        { p_project_id: projectId }
      );

      if (error) throw error;
      return (data || []) as RankedApplication[];
    },
    enabled: !!projectId,
    staleTime: 30 * 1000,
  });
}

