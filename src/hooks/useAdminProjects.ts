import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogger } from "@/hooks/useActivityLogger";

export type Project = {
  id: number;
  title: string;
  description: string;
  sector: string;
  sectorId: number | null;
  status: "new" | "open" | "closing-soon" | "closed" | "archived";
  deadline: string;
  fundingAmount: string;
  currency: string | null;
  opportunityType: string | null;
  location: string;
  country: string | null;
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
  partnerId?: number | null;
};

export type ProjectFormData = {
  title: string;
  description: string;
  sector?: string;
  sectorId?: number | null;
  status: "new" | "open" | "closing-soon" | "closed" | "archived";
  deadline: string; // YYYY-MM-DD format
  fundingAmount?: string | null;
  currency?: string | null;
  opportunityType?: string | null;
  location: string;
  country?: string | null;
  imageUrl?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  applicationFee?: number;
  maxApplicants?: number;
  currentApplicants?: number;
  featured?: boolean;
  partnerId?: number | null;
};

// Transform Supabase snake_case to camelCase
function transformProject(data: any): Project {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    sector: data.sectors?.name || "Uncategorized",
    sectorId: data.sector_id ?? null,
    status: data.status,
    deadline: data.deadline,
    fundingAmount: data.funding_amount,
    currency: data.currency ?? null,
    opportunityType: data.opportunity_type ?? null,
    location: data.location,
    country: data.country ?? null,
    imageUrl: data.image_url,
    requirements: data.requirements,
    eligibilityCriteria: data.eligibility_criteria,
    applicationFee: data.application_fee,
    maxApplicants: data.max_applicants,
    currentApplicants: data.current_applicants || 0,
    featured: data.featured ?? false,
    createdBy: data.created_by,
    partnerId: data.partner_id || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// Helper function to look up sector_id from sector name
async function getSectorId(sectorName: string | undefined): Promise<number | null> {
  if (!sectorName) return null;
  
  const { data: sectorData, error } = await supabase
    .from("sectors")
    .select("id")
    .eq("name", sectorName)
    .eq("is_active", true)
    .single();
  
  if (!error && sectorData) {
    return sectorData.id;
  }
  
  // If sector not found, return null (will be handled gracefully)
  if (error && error.code !== "PGRST116") {
    console.warn(`Error looking up sector "${sectorName}":`, error.message);
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
  if (data.fundingAmount !== undefined) result.funding_amount = data.fundingAmount || null;
  if (data.currency !== undefined) result.currency = data.currency || null;
  if (data.opportunityType !== undefined) result.opportunity_type = data.opportunityType || null;
  if (data.location !== undefined) result.location = data.location;
  if (data.country !== undefined) result.country = data.country || null;
  if (data.imageUrl !== undefined) result.image_url = data.imageUrl || null;
  if (data.requirements !== undefined) result.requirements = data.requirements || null;
  if (data.eligibilityCriteria !== undefined) result.eligibility_criteria = data.eligibilityCriteria || null;
  if (data.applicationFee !== undefined) result.application_fee = data.applicationFee || 0;
  if (data.maxApplicants !== undefined) result.max_applicants = data.maxApplicants || null;
  if (data.currentApplicants !== undefined) result.current_applicants = data.currentApplicants || 0;
  if (data.featured !== undefined) result.featured = data.featured ?? false;
  
  // Handle sector - prefer sectorId, fall back to sector name
  if (data.sectorId !== undefined) {
    result.sector_id = data.sectorId || null;
  } else if (data.sector !== undefined) {
    const sectorId = await getSectorId(data.sector);
    if (sectorId === null) {
      throw new Error(`Sector "${data.sector}" not found. Please select a valid sector.`);
    }
    result.sector_id = sectorId;
  }
  if (data.partnerId !== undefined) {
    result.partner_id = data.partnerId ?? null;
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
        .from("opportunities" as any)
        .select(`
          *,
          sectors:sector_id(name)
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
      if (!id) throw new Error("Opportunity ID is required");
      
      const { data, error } = await supabase
        .from("opportunities" as any)
        .select(`
          *,
          sectors:sector_id(name)
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
      
      // Resolve sector_id from sectorId or sector name
      let sectorId: number | null = data.sectorId ?? null;
      if (!sectorId && data.sector) {
        const { data: sectorData, error: sectorError } = await supabase
          .from("sectors")
          .select("id")
          .eq("name", data.sector)
          .eq("is_active", true)
          .single();
        
        if (!sectorError && sectorData) {
          sectorId = sectorData.id;
        } else if (sectorError && sectorError.code !== "PGRST116") {
          // PGRST116 is "not found" - we'll allow it but log a warning
          console.warn(`sector "${data.sector}" not found in sectors table. sector_id will be null.`);
        }
      }
      
      if (!sectorId) {
        throw new Error("Sector is required. Please select a valid sector.");
      }

      const insertData = {
        title: data.title,
        description: data.description,
        sector_id: sectorId,
        status: data.status,
        deadline: data.deadline,
        funding_amount: data.fundingAmount || null,
        currency: data.currency || "USD",
        opportunity_type: data.opportunityType || null,
        location: data.location,
        country: data.country || null,
        image_url: data.imageUrl || null,
        requirements: data.requirements || null,
        eligibility_criteria: data.eligibilityCriteria || null,
        application_fee: data.applicationFee || 0,
        max_applicants: data.maxApplicants || null,
        current_applicants: data.currentApplicants || 0,
        featured: data.featured ?? false,
        created_by: userId || null,
        partner_id: data.partnerId ?? null,
      };

      const { data: result, error } = await supabase
        .from("opportunities" as any)
        .insert(insertData)
        .select(`
          *,
          sectors:sector_id(name)
        `)
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["featured-opportunities"] });
      
      // Log activity
      logActivity({
        actionType: "create",
        entityType: "opportunity",
        entityId: String(project.id),
        description: `Created opportunity: ${project.title}`,
        metadata: { title: project.title, sector: project.sector },
      });
      
      toast({
        title: "Opportunity created",
        description: "The opportunity has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating opportunity",
        description: error.message || "Failed to create opportunity. Please try again.",
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
        .from("opportunities" as any)
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          sectors:sector_id(name)
        `)
        .single();

      if (error) throw error;
      return transformProject(result);
    },
    onSuccess: (project, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["featured-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] });
      
      // Log activity
      logActivity({
        actionType: "update",
        entityType: "opportunity",
        entityId: String(project.id),
        description: `Updated opportunity: ${project.title}`,
        metadata: { title: project.title },
      });
      
      toast({
        title: "Opportunity updated",
        description: "The opportunity has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating opportunity",
        description: error.message || "Failed to update opportunity. Please try again.",
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
      // Fetch opportunity title before deleting for logging
      const { data: project } = await supabase
        .from("opportunities" as any)
        .select("title")
        .eq("id", id)
        .single();
      
      const { error } = await supabase
        .from("opportunities" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, title: (project as any)?.title || "Unknown" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["featured-opportunities"] });
      
      // Log activity
      logActivity({
        actionType: "delete",
        entityType: "opportunity",
        entityId: String(data.id),
        description: `Deleted opportunity: ${data.title}`,
        metadata: { title: data.title },
      });
      
      toast({
        title: "Opportunity deleted",
        description: "The opportunity has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting opportunity",
        description: error.message || "Failed to delete opportunity. Please try again.",
        variant: "destructive",
      });
    },
  });
}








