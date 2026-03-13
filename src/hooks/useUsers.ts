import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type UserManagement = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "admin" | "reviewer" | "applicant";
  registeredAt: string;
  applicationsCount: number;
  status: "active" | "suspended" | "deleted";
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  businesssector?: string | null;
  country?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
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

      try {
        const { data, error } = await supabase.rpc("get_all_users_for_admin");

        if (error) {
          console.error("Error fetching users:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            fullError: error,
          });
          
          // Check if it's an access denied error
          if (error.message.includes("Access denied") || error.message.includes("Admin role required")) {
            throw new Error("You do not have permission to view users. Admin access required.");
          }
          
          // Check if function doesn't exist
          if (error.code === "PGRST301" || error.message.includes("function") || error.message.includes("does not exist")) {
            throw new Error("Database function not found. Please ensure migrations are up to date.");
          }
          
          // Check for permission errors
          if (error.code === "42501" || error.message.includes("permission") || error.message.includes("denied")) {
            throw new Error("Permission denied. Please ensure you have admin access and the function has proper permissions.");
          }
          
          // Check for schema/table access issues
          if (error.message.includes("relation") || error.message.includes("does not exist") || error.message.includes("auth.users")) {
            throw new Error("Database access error. The function may need to be updated to properly access user data.");
          }
          
          // Generic error with details
          throw new Error(error.message || `Failed to load users: ${error.code || "Unknown error"}`);
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
          firstName: user.first_name ?? null,
          lastName: user.last_name ?? null,
          businessName: user.business_name ?? null,
          businesssector: user.business_sector ?? null,
          country: user.country ?? null,
          bio: user.bio ?? null,
          avatarUrl: user.avatar_url ?? null,
        }));
      } catch (err) {
        // Re-throw our custom errors
        if (err instanceof Error) {
          throw err;
        }
        // Handle unexpected errors
        console.error("Unexpected error in useUsers:", err);
        throw new Error("An unexpected error occurred while loading users.");
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000, // Cache for 30 seconds
    retry: 1,
  });
}

/**
 * Hook to suspend a user
 */
export function useSuspendUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("manage-user", {
        body: {
          userId,
          action: "suspend",
          token: sessionData.session.access_token,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Edge Function error:", response.error);
        const errorMessage = response.error.message || response.error.toString() || "Failed to suspend user";
        throw new Error(errorMessage);
      }

      // Check if response.data contains an error
      if (response.data && response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin"] });
      toast({
        title: "User suspended",
        description: "The user has been suspended successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to suspend user",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to activate a user
 */
export function useActivateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("manage-user", {
        body: {
          userId,
          action: "activate",
          token: sessionData.session.access_token,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        console.error("Edge Function error:", response.error);
        const errorMessage = response.error.message || response.error.toString() || "Failed to activate user";
        throw new Error(errorMessage);
      }

      // Check if response.data contains an error
      if (response.data && response.data.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin"] });
      toast({
        title: "User activated",
        description: "The user has been activated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate user",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to update a user's role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "reviewer" | "applicant" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("user_id", userId);

      if (error) {
        console.error("Error updating user role:", error);
        throw new Error(error.message || "Failed to update user role");
      }

      return { userId, role };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users", "admin"] });
      queryClient.invalidateQueries({ queryKey: ["user-role", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", data.userId] });
      toast({
        title: "Role updated",
        description: `User role has been updated to ${data.role}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });
}









