import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  // Fetch all applications (admins can see all via RLS)
  const { data: applicationsData, error: appsError } = await supabase
    .from("applications")
    .select("*")
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

