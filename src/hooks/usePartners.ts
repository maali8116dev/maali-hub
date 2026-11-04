import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Partner = {
  id: number;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  display_order: number;
};

export type PublicPartner = Partner & {
  description: string | null;
  sector: string;
  featured: boolean;
};

/**
 * Hook to fetch featured partners for landing page
 */
export function useFeaturedPartners() {
  return useQuery({
    queryKey: ["partners", "featured"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await (supabase as any)
        .from("partners_public" as any)
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

/** All active partners for About page (grouped by sector in UI). */
export function usePublicPartners() {
  return useQuery({
    queryKey: ["partners", "public"],
    queryFn: async (): Promise<PublicPartner[]> => {
      const { data, error } = await (supabase as any)
        .from("partners_public" as any)
        .select("*")
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .order("featured", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as PublicPartner[];
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
        .from("partners_public" as any)
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









