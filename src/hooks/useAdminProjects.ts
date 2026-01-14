import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  featured: boolean;
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
  featured?: boolean;
};

// Transform Supabase snake_case to camelCase
function transformProject(data: any): Project {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    deadline: data.deadline,
    fundingAmount: data.funding_amount,
    location: data.location,
    imageUrl: data.image_url,
    requirements: data.requirements,
    eligibilityCriteria: data.eligibility_criteria,
    applicationFee: data.application_fee,
    maxApplicants: data.max_applicants,
    currentApplicants: data.current_applicants || 0,
    featured: data.featured ?? false,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Transform camelCase to snake_case for Supabase
function toSnakeCase(data: ProjectFormData): Record<string, any> {
  return {
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status,
    deadline: data.deadline,
    funding_amount: data.fundingAmount,
    location: data.location,
    image_url: data.imageUrl || null,
    requirements: data.requirements || null,
    eligibility_criteria: data.eligibilityCriteria || null,
    application_fee: data.applicationFee || 0,
    max_applicants: data.maxApplicants || null,
    current_applicants: data.currentApplicants || 0,
    featured: data.featured ?? false,
  };
}

/**
 * Hook to fetch all projects for admin (no pagination, all projects)
 */
export function useAdminProjects() {
  return useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(transformProject);
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
      
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return transformProject(data);
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
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      const insertData = {
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        deadline: data.deadline,
        funding_amount: data.fundingAmount,
        location: data.location,
        image_url: data.imageUrl || null,
        requirements: data.requirements || null,
        eligibility_criteria: data.eligibilityCriteria || null,
        application_fee: data.applicationFee || 0,
        max_applicants: data.maxApplicants || null,
        current_applicants: data.currentApplicants || 0,
        featured: data.featured ?? false,
        created_by: userId || null,
      };

      const { data: result, error } = await supabase
        .from("projects")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
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
      const updateData = toSnakeCase(data as ProjectFormData);
      
      const { data: result, error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
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
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
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
