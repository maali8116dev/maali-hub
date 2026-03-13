import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Profile type matching both API and Supabase responses
export type Profile = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  businesssector: string | null;
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
    businesssector: data.business_sector || data.businesssector,
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
    .select("id, user_id, first_name, last_name, business_name, business_sector, country, bio, avatar_url, role, created_at, updated_at")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return transformProfile(data);
}

/**
 * Direct Supabase update/insert for profile (upsert)
 * Creates profile if it doesn't exist, updates if it does
 */
async function updateProfileDirect(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    businesssector?: string;
    country?: string;
    bio?: string;
    avatarUrl?: string;
  }
): Promise<Profile> {
  // Try to update first
  // Convert empty string to null for avatar_url to properly clear the field
  const { data: updatedData, error: updateError } = await supabase
    .from("profiles")
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      business_name: data.businessName,
      business_sector: data.businesssector,
      country: data.country,
      bio: data.bio,
      avatar_url: data.avatarUrl === "" || data.avatarUrl === undefined ? null : data.avatarUrl,
    })
    .eq("user_id", userId)
    .select()
    .single();

  // If update succeeded, return the updated profile
  if (updatedData && !updateError) {
    return transformProfile(updatedData);
  }

  // If update failed because profile doesn't exist (PGRST116), create it
  if (updateError?.code === "PGRST116" || updateError?.message?.includes("No rows") || updateError?.message?.includes("0 rows")) {
    const { data: insertedData, error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        business_name: data.businessName,
        business_sector: data.businesssector,
        country: data.country,
        bio: data.bio,
        avatar_url: data.avatarUrl === "" || data.avatarUrl === undefined ? null : data.avatarUrl,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return transformProfile(insertedData);
  }

  // If it's a different error, throw it
  if (updateError) throw updateError;

  // Fallback (shouldn't reach here)
  throw new Error("Failed to update or create profile");
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
      try {
        return await fetchProfileDirect(user.id);
      } catch (error: any) {
        // If profile doesn't exist (404 or PGRST116), return null instead of throwing
        // This allows the UI to handle missing profiles gracefully
        if (error?.code === 'PGRST116' || error?.message?.includes('No rows')) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - reduced from 5 minutes for faster role updates
    retry: (failureCount, error: any) => {
      // Don't retry if profile doesn't exist (404/PGRST116)
      if (error?.code === 'PGRST116' || error?.message?.includes('No rows')) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
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
      businesssector?: string;
      country?: string;
      bio?: string;
      avatarUrl?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      return updateProfileDirect(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}








