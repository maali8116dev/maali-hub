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
      // Fetch all counts in parallel
      const [
        profilesResult,
        projectsResult,
        applicationsResult,
        activeProjectsResult,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id, status'),
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      const applications = applicationsResult.data || [];
      const pendingCount = applications.filter(a => a.status === 'pending').length;
      const approvedCount = applications.filter(a => a.status === 'approved').length;
      const rejectedCount = applications.filter(a => a.status === 'rejected').length;

      return {
        totalUsers: profilesResult.count || 0,
        totalProjects: projectsResult.count || 0,
        totalApplications: applications.length,
        pendingApplications: pendingCount,
        approvedApplications: approvedCount,
        rejectedApplications: rejectedCount,
        activeProjects: activeProjectsResult.count || 0,
      };
    },
  });
}
