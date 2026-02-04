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
  // Fetch all submitted applications (exclude drafts - only applicants should see their own drafts)
  const { data: applicationsData, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("is_draft", false) // Exclude drafts - only show submitted applications
    .order("created_at", { ascending: false });

  if (appsError) throw appsError;

  if (!applicationsData || applicationsData.length === 0) {
    return [];
  }

  // Get unique user IDs and project IDs
  const userIds = [...new Set(applicationsData.map((app) => app.user_id))];
  const projectIds = [...new Set(applicationsData.map((app) => app.project_id))];

  // Fetch profiles for all applicants
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", userIds);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
  }

  // Fetch projects for all applications
  const { data: projectsData, error: projectsError } = await supabase
    .from("projects")
    .select("id, title")
    .in("id", projectIds);

  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
  }

  // Create lookup maps
  const profilesMap = new Map(
    (profilesData || []).map((profile) => [
      profile.user_id,
      {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
      },
    ])
  );

  const projectsMap = new Map(
    (projectsData || []).map((project) => [project.id, project.title])
  );

  // Get unique reviewer/admin IDs for reviewed applications
  const reviewerIds = [
    ...new Set(
      applicationsData
        .map((app) => app.reviewed_by)
        .filter(Boolean)
    ),
  ];

  // Fetch profiles for reviewers/admins who reviewed applications (only if there are any)
  let reviewerProfilesMap = new Map<string, string>();
  if (reviewerIds.length > 0) {
    const { data: reviewerProfilesData } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", reviewerIds);

    reviewerProfilesMap = new Map(
      (reviewerProfilesData || []).map((profile) => [
        profile.user_id,
        `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown",
      ])
    );
  }

  // Get all application IDs to fetch reviewer decisions
  const applicationIds = applicationsData.map((app) => app.id);

  // Fetch all reviewer decisions for these applications
  const { data: reviewScoresData } = await supabase
    .from("review_scores")
    .select(`
      application_id,
      reviewer_id,
      recommendation,
      overall_score,
      comments,
      submitted_at,
      reviewer:profiles!reviewer_id(user_id, first_name, last_name)
    `)
    .in("application_id", applicationIds)
    .order("submitted_at", { ascending: false });

  // Create a map of application ID to reviewer decisions
  const reviewerDecisionsMap = new Map<string, ReviewerDecision[]>();
  if (reviewScoresData) {
    reviewScoresData.forEach((score: any) => {
      const appId = score.application_id;
      if (!reviewerDecisionsMap.has(appId)) {
        reviewerDecisionsMap.set(appId, []);
      }
      const decisions = reviewerDecisionsMap.get(appId)!;
      decisions.push({
        reviewerId: score.reviewer_id,
        reviewerName: score.reviewer
          ? `${score.reviewer.first_name || ""} ${score.reviewer.last_name || ""}`.trim() || "Unknown Reviewer"
          : "Unknown Reviewer",
        recommendation: score.recommendation,
        overallScore: score.overall_score,
        comments: score.comments,
        submittedAt: score.submitted_at,
      });
    });
  }

  // Transform applications with applicant names and project titles
  return applicationsData.map((app) => {
    const profile = profilesMap.get(app.user_id);
    const applicantName = profile
      ? `${profile.firstName} ${profile.lastName}`.trim() || "Unknown Applicant"
      : "Unknown Applicant";

    const projectTitle = projectsMap.get(app.project_id) || "Unknown Project";

    return {
      id: app.id,
      applicantName,
      applicantEmail: app.contact_email || "No email",
      projectTitle,
      projectId: app.project_id,
      submittedAt: app.created_at,
      status: statusMap[app.status || "pending"] || "pending",
      fundingAmount: app.funding_amount_requested || "N/A",
      companyName: app.company_name || "N/A",
      contactEmail: app.contact_email || "N/A",
      contactPhone: app.contact_phone || undefined,
      location: app.location || undefined,
      reviewedBy: app.reviewed_by || undefined,
      reviewedAt: app.reviewed_at || undefined,
      reviewNotes: app.review_notes || undefined,
      reviewedByName: app.reviewed_by ? reviewerProfilesMap.get(app.reviewed_by) : undefined,
      reviewerDecisions: reviewerDecisionsMap.get(app.id) || [],
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

