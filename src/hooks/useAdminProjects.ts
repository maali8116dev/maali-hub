import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type Project = {
  id: number;
  title: string;
  description: string;
  category: string;
  status: "new" | "open" | "closing-soon" | "closed";
  deadline: string;
  fundingAmount: string;
  location: string;
  imageUrl: string | null;
  requirements: string | null;
  eligibilityCriteria: string | null;
  applicationFee: number | null;
  maxApplicants: number | null;
  currentApplicants: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectFormData = {
  title: string;
  description: string;
  category: string;
  status: "new" | "open" | "closing-soon" | "closed";
  deadline: string; // YYYY-MM-DD format
  fundingAmount: string;
  location: string;
  imageUrl?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  applicationFee?: number;
  maxApplicants?: number;
  currentApplicants?: number;
};

/**
 * Hook to fetch all projects for admin (no pagination, all projects)
 */
export function useAdminProjects() {
  return useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      // Fetch all projects without pagination
      const response = await api.projects.getAll({
        limit: 1000, // Large limit to get all projects
        offset: 0,
      });
      return response.data as Project[];
    },
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
    retry: 1,
  });
}

/**
 * Hook to fetch a single project by ID
 */
export function useProject(id: number | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) throw new Error("Project ID is required");
      return await api.projects.getById(id) as Project;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

/**
 * Hook to create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ProjectFormData) => {
      return await api.projects.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Project created",
        description: "The project has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating project",
        description: error.message || "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProjectFormData> }) => {
      return await api.projects.update(id, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
      toast({
        title: "Project updated",
        description: "The project has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating project",
        description: error.message || "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return await api.projects.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting project",
        description: error.message || "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });
}

