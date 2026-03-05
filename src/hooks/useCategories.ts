import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryFormData {
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Hook to fetch all active categories (for public use)
 * Categories are static content that rarely changes
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories", "active"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Never consider stale - categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch all categories including inactive ones (admin only)
 * Categories are static content that rarely changes
 */
export function useAllCategories() {
  return useQuery({
    queryKey: ["categories", "all"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity, // Never consider stale - categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch a single category by ID
 * Categories are static content that rarely changes
 */
export function useCategory(categoryId: number | null) {
  return useQuery({
    queryKey: ["categories", categoryId],
    queryFn: async (): Promise<Category | null> => {
      if (!categoryId) return null;

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!categoryId,
    staleTime: Infinity, // Never consider stale - categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch a single category by slug
 * Categories are static content that rarely changes
 */
export function useCategoryBySlug(slug: string | null) {
  return useQuery({
    queryKey: ["categories", "slug", slug],
    queryFn: async (): Promise<Category | null> => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!slug,
    staleTime: Infinity, // Never consider stale - categories rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to create a new category (admin only)
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CategoryFormData): Promise<Category> => {
      // Generate slug if not provided
      const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const { data: category, error } = await supabase
        .from("categories")
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Category Created",
        description: "The category has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update a category (admin only)
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CategoryFormData>;
    }): Promise<Category> => {
      const updateData: any = { ...data };
      
      // Generate slug if name is being updated
      if (data.name && !data.slug) {
        updateData.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      }

      const { data: category, error } = await supabase
        .from("categories")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Category Updated",
        description: "The category has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to delete a category (admin only)
 * Note: This will fail if there are foreign key constraints
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Category Deleted",
        description: "The category has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category. Make sure no projects are using this category.",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to toggle category active status (admin only)
 */
export function useToggleCategoryStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      isActive,
    }: {
      id: number;
      isActive: boolean;
    }): Promise<Category> => {
      const { data: category, error } = await supabase
        .from("categories")
        .update({ is_active: isActive })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: variables.isActive ? "Category Enabled" : "Category Disabled",
        description: `The category has been ${variables.isActive ? "enabled" : "disabled"}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category status",
        variant: "destructive",
      });
    },
  });
}

/**
 * Helper function to get category names as array (for backward compatibility)
 */
export function useCategoryNames(): string[] {
  const { data: categories = [] } = useCategories();
  return categories.map((c) => c.name);
}

