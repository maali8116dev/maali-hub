import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isProjectOpen } from "@/lib/projectAvailability";

export type ApplicationWithProject = {
  id: string;
  projectTitle: string;
  status: "pending" | "approved" | "rejected" | "draft";
  submittedAt: string;
  sector: string;
  country: string;
  projectId: number;
  projectStatus?: string;
  projectDeadline?: string;
  isProjectOpen?: boolean;
  contactEmail: string;
  contactPhone?: string;
      projectSummary: string;
  createdAt: string;
  updatedAt: string;
};

// Status mapping
// Note: pending_payment applications are filtered out at the database level
// Users should only see applications that are actually submitted
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
  pending: "pending",
  pending_payment: "pending", // Map to pending for display, but these are filtered out in RPC
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  draft: "draft",
};

/**
 * RPC-based query for applications with projects (optimized: 1 query instead of N+1)
 */
async function fetchApplicationsDirect(userId: string): Promise<ApplicationWithProject[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_user_applications_with_projects",
    { p_user_id: userId }
  );

  if (rpcError) throw rpcError;

  if (!rpcData || rpcData.length === 0) {
    return [];
  }

  // Map RPC response to ApplicationWithProject type
  return rpcData.map((row: { application: any; project: any }) => {
    const app = row.application;
    const project = row.project;

    return {
      id: app.id,
      projectId: app.project_id,
      projectTitle: project?.title || "Unknown Project",
      projectStatus: project?.status,
      projectDeadline: project?.deadline,
      isProjectOpen: isProjectOpen(project?.status, project?.deadline),
      status: statusMap[app.status || "pending"] || "pending",
      submittedAt: app.created_at,
      sector: project?.category || "Unknown",
      country: app.country_of_residence || app.city_region || "Unknown",
      contactEmail: app.contact_email,
      contactPhone: app.contact_phone || undefined,
      projectSummary: app.project_summary || app.project_title || "No description available",
      createdAt: app.created_at,
      updatedAt: app.updated_at,
    } as ApplicationWithProject;
  });
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
