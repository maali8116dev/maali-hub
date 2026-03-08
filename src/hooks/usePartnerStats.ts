import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePartnerStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-stats", user?.id],
    queryFn: async () => {
      // Get partner's opportunities
      const { data: opportunities, error: oppError } = await supabase
        .from("opportunities")
        .select("id, status")
        .eq("created_by", user!.id);

      if (oppError) throw oppError;

      const opportunityIds = (opportunities || []).map((o) => o.id);

      if (opportunityIds.length === 0) {
        return { totalOpportunities: 0, activeOpportunities: 0, totalApplications: 0, pendingApplications: 0, approvedApplications: 0 };
      }

      // Get applications for those opportunities
      const { data: apps, error: appError } = await supabase
        .from("applications")
        .select("id, status, opportunity_id")
        .in("opportunity_id", opportunityIds)
        .eq("is_draft", false);

      if (appError) throw appError;

      const applications = apps || [];

      return {
        totalOpportunities: opportunities?.length || 0,
        activeOpportunities: opportunities?.filter((o) => o.status === "open" || o.status === "closing-soon").length || 0,
        totalApplications: applications.length,
        pendingApplications: applications.filter((a) => a.status === "pending").length,
        approvedApplications: applications.filter((a) => a.status === "approved").length,
      };
    },
    enabled: !!user,
  });
}
