import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePartnerStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-stats", user?.id],
    queryFn: async () => {
      // Get partner's projects
      const { data: projects, error: projError } = await supabase
        .from("projects")
        .select("id, status")
        .eq("created_by", user!.id);

      if (projError) throw projError;

      const projectIds = (projects || []).map((p) => p.id);

      if (projectIds.length === 0) {
        return { totalProjects: 0, activeProjects: 0, totalApplications: 0, pendingApplications: 0, approvedApplications: 0 };
      }

      // Get applications for those projects
      const { data: apps, error: appError } = await supabase
        .from("applications")
        .select("id, status, project_id")
        .in("project_id", projectIds)
        .eq("is_draft", false);

      if (appError) throw appError;

      const applications = apps || [];

      return {
        totalProjects: projects?.length || 0,
        activeProjects: projects?.filter((p) => p.status === "open" || p.status === "closing-soon").length || 0,
        totalApplications: applications.length,
        pendingApplications: applications.filter((a) => a.status === "pending").length,
        approvedApplications: applications.filter((a) => a.status === "approved").length,
      };
    },
    enabled: !!user,
  });
}
