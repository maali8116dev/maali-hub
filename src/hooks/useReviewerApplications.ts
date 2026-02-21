import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AdminApplication, ReviewerDecision } from "./useAdminApplications";

// Status mapping
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
  pending: "pending",
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  draft: "draft",
};

/**
 * Fetch applications assigned to a specific reviewer
 * Only returns applications that have been assigned via application_assignments
 */
async function fetchReviewerApplications(reviewerId: string): Promise<AdminApplication[]> {
  const { data, error } = await supabase.rpc("get_reviewer_applications", {
    p_reviewer_id: reviewerId,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((app: any) => {
    const reviewerDecisions = Array.isArray(app.reviewer_decisions)
      ? app.reviewer_decisions
      : [];

    return {
      id: app.id,
      applicantName: app.applicant_name || "Unknown Applicant",
      applicantEmail: app.applicant_email || "No email",
      projectTitle: app.project_title || "Unknown Project",
      projectId: app.project_id,
      submittedAt: app.submitted_at,
      status: statusMap[app.status || "pending"] || "pending",
      contactEmail: app.contact_email || "N/A",
      contactPhone: app.contact_phone || undefined,
      reviewedBy: app.reviewed_by || undefined,
      reviewedAt: app.reviewed_at || undefined,
      reviewNotes: app.review_notes || undefined,
      reviewedByName: app.reviewed_by_name || undefined,
      reviewerDecisions: reviewerDecisions.map((decision: any) => ({
        reviewerId: decision.reviewerId,
        reviewerName: decision.reviewerName,
        recommendation: decision.recommendation,
        overallScore: decision.overallScore,
        comments: decision.comments,
        submittedAt: decision.submittedAt,
      })),
    };
  });
}

/**
 * Hook to fetch applications assigned to the current reviewer
 * Only returns applications that have been assigned to the reviewer via application_assignments
 */
export function useReviewerApplications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["reviewer-applications", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error("User ID is required");
      }
      return fetchReviewerApplications(user.id);
    },
    enabled: !!user?.id, // Only enable if user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

