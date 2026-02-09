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
  status: "pending" | "approved" | "rejected" | "draft";
  fundingAmount: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  location?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  reviewedByName?: string;
  reviewerDecisions?: ReviewerDecision[];
};

// Status mapping
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
  pending: "pending",
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  draft: "draft",
};

/**
 * Fetch all applications for admin view
 * Includes applicant name from profiles and project title
 */
async function fetchAllApplicationsForAdmin(): Promise<AdminApplication[]> {
  const { data, error } = await supabase.rpc("get_admin_applications");

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
      fundingAmount: app.funding_amount || "N/A",
      companyName: app.company_name || "N/A",
      contactEmail: app.contact_email || "N/A",
      contactPhone: app.contact_phone || undefined,
      location: app.location || undefined,
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

