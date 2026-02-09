import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  activeProjects: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await supabase.rpc('get_admin_stats');

      if (error) {
        throw error;
      }

      const stats = data?.[0];

      return {
        totalUsers: Number(stats?.total_users ?? 0),
        totalProjects: Number(stats?.total_projects ?? 0),
        totalApplications: Number(stats?.total_applications ?? 0),
        pendingApplications: Number(stats?.pending_applications ?? 0),
        approvedApplications: Number(stats?.approved_applications ?? 0),
        rejectedApplications: Number(stats?.rejected_applications ?? 0),
        activeProjects: Number(stats?.active_projects ?? 0),
      };
    },
  });
}
