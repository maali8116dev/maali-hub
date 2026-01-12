import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Hook to fetch projects with optional filters
 * Uses backend API if available, falls back to direct Supabase query
 */
export function useProjects(filters?: {
  category?: string | null;
  status?: string | null;
  search?: string;
  page?: number;
  itemsPerPage?: number;
}) {
  const page = filters?.page || 1;
  const itemsPerPage = filters?.itemsPerPage || 9;
  const offset = (page - 1) * itemsPerPage;

  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      try {
        // Try backend API first
        const response = await api.projects.getAll({
          category: filters?.category || undefined,
          status: filters?.status || undefined,
          search: filters?.search || undefined,
          limit: itemsPerPage,
          offset,
        });

        return {
          projects: response.data,
          total: response.total,
          page,
          itemsPerPage,
          totalPages: Math.ceil(response.total / itemsPerPage),
        };
      } catch (error: any) {
        // Fallback to direct Supabase query if backend is unavailable
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, using direct Supabase query");

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

          const { data, error: supabaseError, count } = await query;

          if (supabaseError) throw supabaseError;

          return {
            projects: data || [],
            total: count || 0,
            page,
            itemsPerPage,
            totalPages: Math.ceil((count || 0) / itemsPerPage),
          };
        }
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    retry: 1,
  });
}

/**
 * Hook to fetch project categories
 */
export function useProjectCategories() {
  return useQuery({
    queryKey: ["project-categories"],
    queryFn: async () => {
      try {
        return await api.projects.getCategories();
      } catch (error: any) {
        // Fallback to direct Supabase query
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, using direct Supabase query");

          const { data, error: supabaseError } = await supabase
            .from("projects")
            .select("category");

          if (supabaseError) throw supabaseError;

          // Get unique categories
          const uniqueCategories = Array.from(
            new Set((data || []).map((p) => p.category).filter(Boolean))
          ) as string[];

          return uniqueCategories;
        }
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}

