import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ReviewerDecision = {
  reviewerId: string;
  reviewerName: string;
  recommendation: 'approve' | 'reject' | 'request_info' | null;
  overallScore: number | null;
  comments: string | null;
  submittedAt: string | null;
};

export type AdminApplication = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  projectTitle: string;
  projectId: number;
  submittedAt: string;
  status: "pending" | "approved" | "rejected" | "draft" | "under_review";
  contactEmail: string;
  contactPhone?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  reviewedByName?: string;
  reviewerDecisions?: ReviewerDecision[];
  reviewProgress?: {
    completed: number;
    total: number;
  };
  reviewDeadline?: string | null;
};

// Status mapping
// Admins can see pending_payment status for monitoring incomplete applications
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft" | "under_review"> = {
  pending: "pending",
  pending_payment: "pending", // Map to pending for display consistency
  under_review: "under_review",
  approved: "approved",
  rejected: "rejected",
  draft: "draft",
};

/**
 * Fetch all applications for admin view
 * Includes applicant name from profiles and project title
 */
async function fetchAllApplicationsForAdmin(): Promise<AdminApplication[]> {
  try {
    const { data, error } = await supabase.rpc("get_admin_applications");

    if (error) {
      console.error("Error fetching admin applications:", error);
      throw new Error(error.message || "Failed to load applications");
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((app: any) => {
      // Handle reviewer_decisions - it might be JSONB (already parsed) or a string
      let reviewerDecisions: any[] = [];
      try {
        if (app.reviewer_decisions) {
          if (Array.isArray(app.reviewer_decisions)) {
            reviewerDecisions = app.reviewer_decisions;
          } else if (typeof app.reviewer_decisions === 'string') {
            reviewerDecisions = JSON.parse(app.reviewer_decisions);
          } else if (typeof app.reviewer_decisions === 'object') {
            reviewerDecisions = app.reviewer_decisions;
          }
        }
      } catch (parseError) {
        console.warn("Error parsing reviewer_decisions for application", app.id, parseError);
        reviewerDecisions = [];
      }

      const completedReviews = reviewerDecisions.length;
      const hasReviews = completedReviews > 0;
      
      // Preserve pending_payment status for admin visibility
      // Don't map it to pending - admins need to see incomplete applications
      const rawStatus = app.status || "pending";
      const baseStatus = rawStatus === "pending_payment" 
        ? "pending_payment" 
        : (statusMap[rawStatus] || "pending");
      
      // Determine if application is under review (has some reviews but not final decision)
      // But don't change pending_payment to under_review
      const finalStatus = (hasReviews && baseStatus === "pending" && rawStatus !== "pending_payment")
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
        reviewerDecisions: Array.isArray(reviewerDecisions)
          ? reviewerDecisions.map((decision: any) => ({
              reviewerId: decision.reviewerId,
              reviewerName: decision.reviewerName,
              recommendation: decision.recommendation,
              overallScore: decision.overallScore,
              comments: decision.comments,
              submittedAt: decision.submittedAt,
            }))
          : [],
        reviewProgress: hasReviews ? {
          completed: completedReviews,
          total: completedReviews + 1, // Estimate: assume at least one more reviewer pending
        } : undefined,
      };
    });
  } catch (err) {
    console.error("Error in fetchAllApplicationsForAdmin:", err);
    throw err instanceof Error ? err : new Error("Unknown error occurred while loading applications");
  }
}

/**
 * Hook to fetch all applications for admin management
 * RLS policies will restrict access to admins and reviewers only
 */
export function useAdminApplications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-applications"],
    queryFn: fetchAllApplicationsForAdmin,
    enabled: !!user, // Only enable if user is authenticated
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

