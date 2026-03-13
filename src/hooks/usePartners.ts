import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Partner = {
  id: number;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  display_order: number;
};

/**
 * Hook to fetch featured partners for landing page
 */
export function useFeaturedPartners() {
  return useQuery({
    queryKey: ["partners", "featured"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await (supabase as any)
        .from("partners")
        .select("id, name, logo_url, website_url, display_order")
        .eq("status", "active")
        .eq("featured", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as Partner[];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch all active partners (for filter dropdowns)
 */
export function useActivePartners() {
  return useQuery({
    queryKey: ["partners", "active"],
    queryFn: async (): Promise<Pick<Partner, "id" | "name">[]> => {
      const { data, error } = await (supabase as any)
        .from("partners")
        .select("id, name")
        .eq("status", "active")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as Pick<Partner, "id" | "name">[];
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}









