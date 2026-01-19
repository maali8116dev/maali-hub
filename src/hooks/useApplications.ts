import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ApplicationWithProject = {
  id: string;
  projectTitle: string;
  status: "pending" | "approved" | "rejected" | "draft";
  submittedAt: string;
  sector: string;
  country: string;
  fundingAmount: string;
  projectId: number;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  projectDescription: string;
  createdAt: string;
  updatedAt: string;
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
 * Direct Supabase query for applications
 */
async function fetchApplicationsDirect(userId: string): Promise<ApplicationWithProject[]> {
  const { data: applicationsData, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (appsError) throw appsError;

  if (!applicationsData || applicationsData.length === 0) {
    return [];
  }

  // Fetch project details for each application
  const applicationsWithProjects = await Promise.all(
    applicationsData.map(async (app) => {
      try {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("*")
          .eq("id", app.project_id)
          .single();

        if (projectError) {
          console.error(`Error fetching project ${app.project_id}:`, projectError);
        }

        return {
          id: app.id,
          projectId: app.project_id,
          projectTitle: project?.title || "Unknown Project",
          status: statusMap[app.status || "pending"] || "pending",
          submittedAt: app.created_at,
          sector: project?.category || "Unknown",
          country: app.location || "Unknown",
          fundingAmount: app.funding_amount_requested,
          companyName: app.company_name,
          contactEmail: app.contact_email,
          contactPhone: app.contact_phone || undefined,
          projectDescription: app.project_description,
          createdAt: app.created_at,
          updatedAt: app.updated_at,
        } as ApplicationWithProject;
      } catch (error) {
        console.error(`Error processing application ${app.id}:`, error);
        return {
          id: app.id,
          projectId: app.project_id,
          projectTitle: "Unknown Project",
          status: statusMap[app.status || "pending"] || "pending",
          submittedAt: app.created_at,
          sector: "Unknown",
          country: app.location || "Unknown",
          fundingAmount: app.funding_amount_requested,
          companyName: app.company_name,
          contactEmail: app.contact_email,
          contactPhone: app.contact_phone || undefined,
          projectDescription: app.project_description,
          createdAt: app.created_at,
          updatedAt: app.updated_at,
        } as ApplicationWithProject;
      }
    })
  );

  return applicationsWithProjects;
}

/**
 * Hook to fetch user applications with project details
 */
export function useApplications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      return fetchApplicationsDirect(user.id);
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
