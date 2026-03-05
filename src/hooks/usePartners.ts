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
 * Partners are relatively static content that rarely changes
 */
export function useFeaturedPartners() {
  return useQuery({
    queryKey: ["partners", "featured"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, logo_url, website_url, display_order")
        .eq("status", "active")
        .eq("featured", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as Partner[];
    },
    staleTime: Infinity, // Partners rarely change
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

