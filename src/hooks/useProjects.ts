import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  location?: string | null;
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

  if (filters?.location) {
    query = query.eq("location", filters.location);
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
 * Hook to fetch projects with optional filters
 */
export function useProjects(filters?: {
  category?: string | null;
  status?: string | null;
  location?: string | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      return fetchProjectsDirect(filters);
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
      return fetchCategoriesDirect();
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Direct Supabase query for locations (regions)
 */
async function fetchLocationsDirect(): Promise<string[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("location");

  if (error) throw error;

  return Array.from(
    new Set((data || []).map((p) => p.location).filter(Boolean))
  ).sort() as string[];
}

/**
 * Hook to fetch project locations/regions
 */
export function useProjectLocations() {
  return useQuery({
    queryKey: ["project-locations"],
    queryFn: async () => {
      return fetchLocationsDirect();
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
      return fetchFeaturedProjectsDirect();
    },
    staleTime: 5 * 60 * 1000,
  });
}
