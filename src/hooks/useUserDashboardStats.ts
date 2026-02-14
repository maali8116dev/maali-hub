import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserDashboardStats {
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  draftApplications: number;
  totalProjectsApplied: number;
}

/**
 * Hook to fetch user dashboard stats using RPC
 */
export function useUserDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-dashboard-stats", user?.id],
    queryFn: async (): Promise<UserDashboardStats> => {
      if (!user?.id) {
        return {
          totalApplications: 0,
          pendingApplications: 0,
          approvedApplications: 0,
          rejectedApplications: 0,
          draftApplications: 0,
          totalProjectsApplied: 0,
        };
      }

      const { data, error } = await supabase.rpc("get_user_dashboard_stats", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          totalApplications: 0,
          pendingApplications: 0,
          approvedApplications: 0,
          rejectedApplications: 0,
          draftApplications: 0,
          totalProjectsApplied: 0,
        };
      }

      const stats = data[0];

      return {
        totalApplications: Number(stats?.total_applications || 0),
        pendingApplications: Number(stats?.pending_applications || 0),
        approvedApplications: Number(stats?.approved_applications || 0),
        rejectedApplications: Number(stats?.rejected_applications || 0),
        draftApplications: Number(stats?.draft_applications || 0),
        totalProjectsApplied: Number(stats?.total_projects_applied || 0),
      };
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

