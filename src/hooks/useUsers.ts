import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserManagement = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "admin" | "reviewer" | "applicant";
  registeredAt: string;
  applicationsCount: number;
  status: "active" | "suspended" | "deleted";
};

/**
 * Hook to fetch all users for admin management
 * Uses the get_all_users_for_admin() database function
 */
export function useUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["users", "admin"],
    queryFn: async (): Promise<UserManagement[]> => {
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.rpc("get_all_users_for_admin");

      if (error) {
        // Check if it's an access denied error
        if (error.message.includes("Access denied") || error.message.includes("Admin role required")) {
          throw new Error("You do not have permission to view users. Admin access required.");
        }
        throw error;
      }

      if (!data) {
        return [];
      }

      // Transform the database response to match our type
      return data.map((user: any) => ({
        id: user.id,
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        registeredAt: user.registered_at,
        applicationsCount: user.applications_count || 0,
        status: user.status as "active" | "suspended" | "deleted",
      }));
    },
    enabled: !!user,
    staleTime: 30 * 1000, // Cache for 30 seconds
    retry: 1,
  });
}

