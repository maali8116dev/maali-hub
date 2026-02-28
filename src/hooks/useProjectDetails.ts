import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDraft } from "@/hooks/useUserDrafts";
import { useAuth } from "@/hooks/useAuth";

export interface ProjectWithCategory {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  funding_amount: string | null;
  deadline: string;
  status: string;
  category: string;
  requirements: string | null;
  eligibility_criteria: string | null;
  application_fee: number | null;
  created_at: string;
  [key: string]: unknown;
}

interface UseProjectDetailsReturn {
  project: ProjectWithCategory | undefined;
  isLoading: boolean;
  error: Error | null;
  draft: { updated_at: string } | null | undefined;
  existingApplication: { id: string; status: string; is_draft: boolean } | null | undefined;
  hasSubmittedApplication: boolean;
  hasApprovedApplication: boolean;
}

/**
 * Hook for fetching project details and related data
 */
export function useProjectDetails(projectId: string | undefined): UseProjectDetailsReturn {
  const { user } = useAuth();

  // Fetch project data
  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID is required");

      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          categories:category_id(name)
        `)
        .eq("id", parseInt(projectId))
        .single();

      if (error) throw error;
      // Add category property from joined table
      return {
        ...data,
        category: (data as any).categories?.name || "Uncategorized",
      } as ProjectWithCategory;
    },
    enabled: !!projectId,
  });

  // Check if user has a draft for this project
  const { data: draft } = useProjectDraft(projectId ? parseInt(projectId) : undefined);

  // Check if user already has a submitted (non-draft) application for this project
  const { data: existingApplication } = useQuery({
    queryKey: ["user-project-application", user?.id, projectId],
    queryFn: async () => {
      if (!user || !projectId) return null;
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, is_draft")
        .eq("user_id", user.id)
        .eq("project_id", parseInt(projectId))
        .eq("is_draft", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking existing application:", error);
        return null;
      }
      return data;
    },
    enabled: !!user && !!projectId,
  });

  const hasSubmittedApplication = !!existingApplication;
  const hasApprovedApplication = existingApplication?.status === "approved";

  return {
    project,
    isLoading,
    error: error as Error | null,
    draft,
    existingApplication: existingApplication as { id: string; status: string; is_draft: boolean } | null | undefined,
    hasSubmittedApplication,
    hasApprovedApplication,
  };
}

