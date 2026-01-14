import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { isDirectMode } from "@/lib/dataConfig";

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
  applicationFee: string | null;
  maxApplicants: number | null;
  currentApplicants: number;
  featured: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
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
    fundingAmount: data.funding_amount || data.fundingAmount,
    location: data.location,
    imageUrl: data.image_url || data.imageUrl,
    requirements: data.requirements,
    eligibilityCriteria: data.eligibility_criteria || data.eligibilityCriteria,
    applicationFee: data.application_fee?.toString() || data.applicationFee,
    maxApplicants: data.max_applicants || data.maxApplicants,
    currentApplicants: data.current_applicants || data.currentApplicants || 0,
    featured: data.featured ?? false,
    createdBy: data.created_by || data.createdBy,
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
  };
}

/**
 * Direct Supabase query for projects
 */
async function fetchProjectsDirect(filters?: {
  category?: string | null;
  status?: string | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  const page = filters?.page || 1;
  const itemsPerPage = filters?.itemsPerPage || 9;
  const offset = (page - 1) * itemsPerPage;

  let query = supabase
    .from("projects")
    .select("*", { count: "exact" });

  // Apply filters
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    query = query.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,funding_amount.ilike.%${searchTerm}%`
    );
  }

  // Apply pagination
  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + itemsPerPage - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    projects: (data || []).map(transformProject),
    total: count || 0,
    page,
    itemsPerPage,
    totalPages: Math.ceil((count || 0) / itemsPerPage),
  };
}

/**
 * Backend API query for projects
 */
async function fetchProjectsApi(filters?: {
  category?: string | null;
  status?: string | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  const page = filters?.page || 1;
  const itemsPerPage = filters?.itemsPerPage || 9;
  const offset = (page - 1) * itemsPerPage;

  const response = await api.projects.getAll({
    category: filters?.category || undefined,
    status: filters?.status || undefined,
    search: filters?.search || undefined,
    limit: itemsPerPage,
    offset,
  });

  return {
    projects: response.data.map(transformProject),
    total: response.total,
    page,
    itemsPerPage,
    totalPages: Math.ceil(response.total / itemsPerPage),
  };
}

/**
 * Hook to fetch projects with optional filters
 */
export function useProjects(filters?: {
  category?: string | null;
  status?: string | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      if (isDirectMode()) {
        return fetchProjectsDirect(filters);
      }
      
      try {
        return await fetchProjectsApi(filters);
      } catch (error: any) {
        // Fallback to direct if API fails
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, falling back to direct Supabase");
          return fetchProjectsDirect(filters);
        }
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Direct Supabase query for categories
 */
async function fetchCategoriesDirect(): Promise<string[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("category");

  if (error) throw error;

  return Array.from(
    new Set((data || []).map((p) => p.category).filter(Boolean))
  ) as string[];
}

/**
 * Hook to fetch project categories
 */
export function useProjectCategories() {
  return useQuery({
    queryKey: ["project-categories"],
    queryFn: async () => {
      if (isDirectMode()) {
        return fetchCategoriesDirect();
      }

      try {
        return await api.projects.getCategories();
      } catch (error: any) {
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, falling back to direct Supabase");
          return fetchCategoriesDirect();
        }
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Direct Supabase query for featured projects
 */
async function fetchFeaturedProjectsDirect(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("featured", true)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) throw error;

  return (data || []).map(transformProject);
}

/**
 * Hook to fetch featured projects for homepage
 */
export function useFeaturedProjects() {
  return useQuery({
    queryKey: ["featured-projects"],
    queryFn: async () => {
      if (isDirectMode()) {
        return fetchFeaturedProjectsDirect();
      }

      try {
        // API fallback - filter featured from all projects
        const response = await api.projects.getAll({ limit: 100 });
        return response.data
          .map(transformProject)
          .filter((p) => p.featured && p.status !== "closed")
          .slice(0, 6);
      } catch (error: any) {
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, falling back to direct Supabase");
          return fetchFeaturedProjectsDirect();
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
