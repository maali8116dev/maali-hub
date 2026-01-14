import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isDirectMode } from "@/lib/dataConfig";

// Profile type matching both API and Supabase responses
export type Profile = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  businessSector: string | null;
  country: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: "admin" | "reviewer" | "applicant";
  createdAt: string;
  updatedAt: string;
};

// Transform Supabase snake_case to camelCase
function transformProfile(data: any): Profile {
  return {
    id: data.id,
    userId: data.user_id || data.userId,
    firstName: data.first_name || data.firstName,
    lastName: data.last_name || data.lastName,
    businessName: data.business_name || data.businessName,
    businessSector: data.business_sector || data.businessSector,
    country: data.country,
    bio: data.bio,
    avatarUrl: data.avatar_url || data.avatarUrl,
    role: data.role,
    createdAt: data.created_at || data.createdAt,
    updatedAt: data.updated_at || data.updatedAt,
  };
}

/**
 * Direct Supabase query for profile
 */
async function fetchProfileDirect(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return transformProfile(data);
}

/**
 * Direct Supabase update for profile
 */
async function updateProfileDirect(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    businessSector?: string;
    country?: string;
    bio?: string;
    avatarUrl?: string;
  }
): Promise<Profile> {
  const { data: updatedData, error } = await supabase
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
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return transformProfile(updatedData);
}

/**
 * Hook to fetch the current user's profile
 */
export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      if (isDirectMode()) {
        return fetchProfileDirect(user.id);
      }

      try {
        const data = await api.profiles.getMe();
        return transformProfile(data);
      } catch (error: any) {
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, falling back to direct Supabase");
          return fetchProfileDirect(user.id);
        }
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
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
      if (!user) throw new Error("Not authenticated");

      if (isDirectMode()) {
        return updateProfileDirect(user.id, data);
      }

      try {
        const result = await api.profiles.update(data);
        return transformProfile(result);
      } catch (error: any) {
        if (error.message?.includes("fetch") || error.message?.includes("Failed to fetch")) {
          console.warn("Backend API unavailable, falling back to direct Supabase");
          return updateProfileDirect(user.id, data);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
