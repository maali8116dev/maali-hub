import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isOpportunityOpen } from "@/lib/opportunityAvailability";

export type ApplicationWithOpportunity = {
  id: string;
  opportunityTitle: string;
  status: "pending" | "approved" | "rejected" | "draft";
  submittedAt: string;
  sector: string;
  country: string;
  opportunityId: number;
  opportunityStatus?: string;
  opportunityDeadline?: string;
  isOpportunityOpen?: boolean;
  contactEmail: string;
  contactPhone?: string;
  projectSummary: string;
  createdAt: string;
  updatedAt: string;
};

// Status mapping
// Note: pending_payment applications are filtered out at the database level
// Users should only see applications that are actually submitted
const statusMap: Record<string, "pending" | "approved" | "rejected" | "draft"> = {
  pending: "pending",
  pending_payment: "pending", // Map to pending for display, but these are filtered out in RPC
  under_review: "pending",
  approved: "approved",
  rejected: "rejected",
  draft: "draft",
};

/**
 * RPC-based query for applications with opportunities (optimized: 1 query instead of N+1)
 */
async function fetchApplicationsDirect(userId: string): Promise<ApplicationWithOpportunity[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_user_applications_with_opportunities" as any,
    { p_user_id: userId }
  );

  if (rpcError) throw rpcError;

  if (!rpcData || (rpcData as any[]).length === 0) {
    return [];
  }

  const rows = rpcData as { application: any; opportunity: any }[];

  const sectorIds = [
    ...new Set(
      rows
        .map((row) => row.opportunity?.sector_id as number | undefined)
        .filter((id): id is number => id != null)
    ),
  ];

  let sectorNameById = new Map<number, string>();
  if (sectorIds.length > 0) {
    const { data: sectors, error: sectorsError } = await supabase
      .from("sectors")
      .select("id, name")
      .in("id", sectorIds);

    if (sectorsError) throw sectorsError;

    sectorNameById = new Map((sectors ?? []).map((s) => [s.id, s.name]));
  }

  // Map RPC response to ApplicationWithOpportunity type
  return rows.map((row) => {
    const app = row.application;
    const opportunity = row.opportunity;

    const sector =
      (opportunity?.sector_id != null
        ? sectorNameById.get(opportunity.sector_id)
        : null) ||
      opportunity?.opportunity_type ||
      "Unknown";

    return {
      id: app.id,
      opportunityId: app.opportunity_id,
      opportunityTitle: opportunity?.title || "Unknown Opportunity",
      opportunityStatus: opportunity?.status,
      opportunityDeadline: opportunity?.deadline,
      isOpportunityOpen: isOpportunityOpen(opportunity?.status, opportunity?.deadline),
      status: statusMap[app.status || "pending"] || "pending",
      submittedAt: app.created_at,
      sector,
      country: app.country_of_residence || app.city_region || "Unknown",
      contactEmail: app.contact_email,
      contactPhone: app.contact_phone || undefined,
      projectSummary: app.project_summary || app.project_title || "No description available",
      createdAt: app.created_at,
      updatedAt: app.updated_at,
    } as ApplicationWithOpportunity;
  });
}

/**
 * Hook to fetch user applications with opportunity details
 */
export function useApplications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      return fetchApplicationsDirect(user.id);
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}








