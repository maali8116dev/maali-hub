import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { AdminApplication, ReviewerDecision } from "./useAdminApplications";

// Status mapping
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft" | "under_review"> = {
  pending: "pending",
  under_review: "under_review",
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

  if (error) {
    console.error("Error fetching reviewer applications:", {
      error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      reviewerId,
    });
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data
    .filter((app: any) => {
      // Defense in depth: Only return applications that have an assignment_id
      // The RPC should already filter this via INNER JOIN, but this adds extra safety
      return app.assignment_id != null;
    })
    .map((app: any) => {
      const reviewerDecisions = Array.isArray(app.reviewer_decisions)
        ? app.reviewer_decisions
        : [];

      const completedReviews = reviewerDecisions.length;
      const hasReviews = completedReviews > 0;
      const baseStatus = statusMap[app.status || "pending"] || "pending";
      
      // Determine if application is under review (has some reviews but not final decision)
      const finalStatus = hasReviews && baseStatus === "pending" 
        ? "under_review" 
        : baseStatus;

      return {
        id: app.id,
        applicantName: app.applicant_name || "Unknown Applicant",
        applicantEmail: app.applicant_email || "No email",
        projectTitle: app.project_title || "Unknown Project",
        projectId: app.project_id,
        submittedAt: app.submitted_at,
        status: finalStatus,
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
        reviewProgress: (app.total_assignments && app.total_assignments > 0) ? {
          completed: completedReviews,
          total: app.total_assignments, // Use actual assignment count from RPC if available
        } : (hasReviews ? {
          completed: completedReviews,
          total: Math.max(completedReviews + 1, 2), // Better estimate: at least 2 reviewers expected
        } : undefined),
        reviewDeadline: app.review_deadline || undefined,
      };
    });
}

/**
 * Hook to fetch applications assigned to the current reviewer
 * Only returns applications that have been assigned to the reviewer via application_assignments
 */
export function useReviewerApplications() {
  const { user } = useAuth();
  const { data: userRole } = useUserRole();

  return useQuery({
    queryKey: ["reviewer-applications", user?.id],
    queryFn: () => {
      if (!user?.id) {
        throw new Error("User ID is required");
      }
      return fetchReviewerApplications(user.id);
    },
    enabled: !!user?.id && userRole === "reviewer", // Only enable if user is authenticated and is a reviewer
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}









