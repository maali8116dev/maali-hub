import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  // Additional fields from API
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  projectDescription: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Hook to fetch user applications with project details
 * Uses backend API if available, falls back to direct Supabase query
 */
export function useApplications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      try {
        // Try backend API first
        const applications = await api.applications.getAll();

        if (!applications || applications.length === 0) {
          return [];
        }

        // Fetch project details for each application
        const applicationsWithProjects = await Promise.all(
          applications.map(async (app: any) => {
            try {
              // Fetch project details
              const project = await api.projects.getById(app.projectId);
              
              // Map status from backend to UI format
              const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
                pending: "pending",
                under_review: "pending",
                approved: "approved",
                rejected: "rejected",
                draft: "draft",
              };

              return {
                id: app.id,
                projectId: app.projectId,
                projectTitle: project?.title || "Unknown Project",
                status: statusMap[app.status] || "pending",
                submittedAt: app.createdAt,
                sector: project?.category || "Unknown",
                country: app.location || "Unknown",
                fundingAmount: app.fundingAmountRequested,
                companyName: app.companyName,
                contactEmail: app.contactEmail,
                contactPhone: app.contactPhone,
                projectDescription: app.projectDescription,
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
              } as ApplicationWithProject;
            } catch (error) {
              console.error(`Error fetching project ${app.projectId}:`, error);
              // Return application without project details
              return {
                id: app.id,
                projectId: app.projectId,
                projectTitle: "Unknown Project",
                status: (app.status === "under_review" ? "pending" : app.status) as "pending" | "approved" | "rejected" | "draft",
                submittedAt: app.createdAt,
                sector: "Unknown",
                country: app.location || "Unknown",
                fundingAmount: app.fundingAmountRequested,
                companyName: app.companyName,
                contactEmail: app.contactEmail,
                contactPhone: app.contactPhone,
                projectDescription: app.projectDescription,
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
              } as ApplicationWithProject;
            }
          })
        );

        return applicationsWithProjects;
      } catch (error: any) {
        // Fallback to direct Supabase query if backend is unavailable
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, using direct Supabase query");

          // Fetch applications from Supabase
          const { data: applicationsData, error: appsError } = await supabase
            .from("applications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (appsError) throw appsError;

          if (!applicationsData || applicationsData.length === 0) {
            return [];
          }

          // Fetch project details for each application
          const applicationsWithProjects = await Promise.all(
            applicationsData.map(async (app) => {
              try {
                // Fetch project from Supabase
                const { data: project, error: projectError } = await supabase
                  .from("projects")
                  .select("*")
                  .eq("id", app.project_id)
                  .single();

                if (projectError) {
                  console.error(`Error fetching project ${app.project_id}:`, projectError);
                }

                const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
                  pending: "pending",
                  under_review: "pending",
                  approved: "approved",
                  rejected: "rejected",
                  draft: "draft",
                };

                return {
                  id: app.id,
                  projectId: app.project_id,
                  projectTitle: project?.title || "Unknown Project",
                  status: statusMap[app.status] || "pending",
                  submittedAt: app.created_at,
                  sector: project?.category || "Unknown",
                  country: app.location || "Unknown",
                  fundingAmount: app.funding_amount_requested,
                  companyName: app.company_name,
                  contactEmail: app.contact_email,
                  contactPhone: app.contact_phone,
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
                  status: (app.status === "under_review" ? "pending" : app.status) as "pending" | "approved" | "rejected" | "draft",
                  submittedAt: app.created_at,
                  sector: "Unknown",
                  country: app.location || "Unknown",
                  fundingAmount: app.funding_amount_requested,
                  companyName: app.company_name,
                  contactEmail: app.contact_email,
                  contactPhone: app.contact_phone,
                  projectDescription: app.project_description,
                  createdAt: app.created_at,
                  updatedAt: app.updated_at,
                } as ApplicationWithProject;
              }
            })
          );

          return applicationsWithProjects;
        }
        throw error;
      }
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    retry: 1,
  });
}

