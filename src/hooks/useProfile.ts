import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch the current user's profile
 * Uses backend API if available, falls back to direct Supabase query
 */
export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      try {
        // Try backend API first
        return await api.profiles.getMe();
      } catch (error: any) {
        // Fallback to direct Supabase query if backend is unavailable
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, using direct Supabase query");
          
          const { data, error: supabaseError } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();
          
          if (supabaseError) throw supabaseError;
          return data;
        }
        throw error;
      }
    },
    enabled: !!user, // Only fetch when user is logged in
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Retry once on failure
  });
}

/**
 * Hook to update the current user's profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      firstName?: string;
      lastName?: string;
      businessName?: string;
      businessSector?: string;
      country?: string;
      bio?: string;
      avatarUrl?: string;
    }) => {
      try {
        // Try backend API first
        return await api.profiles.update(data);
      } catch (error: any) {
        // Fallback to direct Supabase update if backend is unavailable
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, using direct Supabase update");
          
          if (!user) throw new Error("Not authenticated");
          
          const { data: updatedData, error: supabaseError } = await supabase
            .from("profiles")
            .update({
              first_name: data.firstName,
              last_name: data.lastName,
              business_name: data.businessName,
              business_sector: data.businessSector,
              country: data.country,
              bio: data.bio,
              avatar_url: data.avatarUrl,
            })
            .eq("user_id", user.id)
            .select()
            .single();
          
          if (supabaseError) throw supabaseError;
          return updatedData;
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch profile data
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

