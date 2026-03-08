import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "reviewer" | "applicant" | "partner";

/**
 * Lightweight hook to fetch only the user's role.
 * Much faster than loading the entire profile when you only need the role for routing/auth.
 */
export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<UserRole | null> => {
      if (!user) return null;

      // Only select the role column - much lighter than fetching entire profile
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If profile doesn't exist, default to applicant
        if (error.code === "PGRST116" || error.message?.includes("No rows")) {
          return "applicant";
        }
        throw error;
      }

      return (data?.role as UserRole) || "applicant";
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - same as profile for consistency
    retry: (failureCount, error: any) => {
      // Don't retry if profile doesn't exist (defaults to applicant)
      if (error?.code === "PGRST116" || error?.message?.includes("No rows")) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
  });
}

