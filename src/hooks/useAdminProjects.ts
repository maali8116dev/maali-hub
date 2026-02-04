import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export type Project = {
  id: number;
  title: string;
  description: string;
  category: string;
  status: "new" | "open" | "closing-soon" | "closed" | "archived";
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
  status: "new" | "open" | "closing-soon" | "closed" | "archived";
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
    category: data.categories?.name || 'Uncategorized',
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

// Helper function to look up category_id from category name
async function getCategoryId(categoryName: string | undefined): Promise<number | null> {
  if (!categoryName) return null;
  
  const { data: categoryData, error } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .eq("is_active", true)
    .single();
  
  if (!error && categoryData) {
    return categoryData.id;
  }
  
  // If category not found, return null (will be handled gracefully)
  if (error && error.code !== 'PGRST116') {
    console.warn(`Error looking up category "${categoryName}":`, error.message);
  }
  
  return null;
}

// Transform camelCase to snake_case for Supabase (handles partial updates)
async function toSnakeCase(data: Partial<ProjectFormData>): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  
  // Only include fields that are present in the data
  if (data.title !== undefined) result.title = data.title;
  if (data.description !== undefined) result.description = data.description;
  if (data.status !== undefined) result.status = data.status;
  if (data.deadline !== undefined) result.deadline = data.deadline;
  if (data.fundingAmount !== undefined) result.funding_amount = data.fundingAmount;
  if (data.location !== undefined) result.location = data.location;
  if (data.imageUrl !== undefined) result.image_url = data.imageUrl || null;
  if (data.requirements !== undefined) result.requirements = data.requirements || null;
  if (data.eligibilityCriteria !== undefined) result.eligibility_criteria = data.eligibilityCriteria || null;
  if (data.applicationFee !== undefined) result.application_fee = data.applicationFee || 0;
  if (data.maxApplicants !== undefined) result.max_applicants = data.maxApplicants || null;
  if (data.currentApplicants !== undefined) result.current_applicants = data.currentApplicants || 0;
  if (data.featured !== undefined) result.featured = data.featured ?? false;
  
  // Handle category - convert category name to category_id
  if (data.category !== undefined) {
    // Look up category_id from category name
    const categoryId = await getCategoryId(data.category);
    if (categoryId === null) {
      throw new Error(`Category "${data.category}" not found. Please select a valid category.`);
    }
    result.category_id = categoryId;
  }
  
  return result;
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
        .select(`
          *,
          categories:category_id(name)
        `)
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
        .select(`
          *,
          categories:category_id(name)
        `)
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
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      
      // Look up category_id from category name
      let categoryId: number | null = null;
      if (data.category) {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("id")
          .eq("name", data.category)
          .eq("is_active", true)
          .single();
        
        if (!categoryError && categoryData) {
          categoryId = categoryData.id;
        } else if (categoryError && categoryError.code !== 'PGRST116') {
          // PGRST116 is "not found" - we'll allow it but log a warning
          console.warn(`Category "${data.category}" not found in categories table. category_id will be null.`);
        }
      }
      
      if (!categoryId) {
        throw new Error(`Category "${data.category}" not found. Please select a valid category.`);
      }

      const insertData = {
        title: data.title,
        description: data.description,
        category_id: categoryId,
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
        .select(`
          *,
          categories:category_id(name)
        `)
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
      
      // Log activity
      logActivity({
        actionType: "create",
        entityType: "project",
        entityId: String(project.id),
        description: `Created project: ${project.title}`,
        metadata: { title: project.title, category: project.category },
      });
      
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
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProjectFormData> }) => {
      const updateData = await toSnakeCase(data as ProjectFormData);
      
      const { data: result, error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          categories:category_id(name)
        `)
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: (project, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
      
      // Log activity
      logActivity({
        actionType: "update",
        entityType: "project",
        entityId: String(project.id),
        description: `Updated project: ${project.title}`,
        metadata: { title: project.title },
      });
      
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
  const { logActivity } = useActivityLogger();

  return useMutation({
    mutationFn: async (id: number) => {
      // Fetch project title before deleting for logging
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", id)
        .single();
      
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, title: project?.title || "Unknown" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["featured-projects"] });
      
      // Log activity
      logActivity({
        actionType: "delete",
        entityType: "project",
        entityId: String(data.id),
        description: `Deleted project: ${data.title}`,
        metadata: { title: data.title },
      });
      
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
