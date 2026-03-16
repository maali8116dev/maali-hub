import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOpportunityDraft } from "@/hooks/useUserDrafts";
import { useAuth } from "@/hooks/useAuth";
import { Opportunity, OpportunityTag, transformOpportunity } from "./useOpportunities";

export interface OpportunityWithTags extends Opportunity {
  tags: OpportunityTag[];
}

interface UseOpportunityDetailsReturn {
  opportunity: OpportunityWithTags | undefined;
  isLoading: boolean;
  error: Error | null;
  draft: { updated_at: string } | null | undefined;
  existingApplication: { id: string; status: string; is_draft: boolean } | null | undefined;
  hasSubmittedApplication: boolean;
  hasApprovedApplication: boolean;
}

/**
 * Hook for fetching opportunity details and related data
 */
export function useOpportunityDetails(opportunityId: string | undefined): UseOpportunityDetailsReturn {
  const { user } = useAuth();

  // Fetch opportunity data
  const { data: opportunity, isLoading, error } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: async () => {
      if (!opportunityId) throw new Error("Opportunity ID is required");

      const opportunityIdNum = parseInt(opportunityId);
      if (isNaN(opportunityIdNum)) {
        throw new Error(`Invalid opportunity ID: ${opportunityId}`);
      }

      const { data, error } = await (supabase
        .from("opportunities" as any)
        .select(`
          *,
          sector:sectors(name),
          tags:opportunity_tag_map(
            tag:opportunity_tags(id, name, slug)
          )
        `)
        .eq("id", opportunityIdNum)
        .single() as any);

      if (error) {
        console.error("Error fetching opportunity:", {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          opportunityId: opportunityIdNum,
        });
        
        // If it's a "not found" error (PGRST116), provide a clearer message
        if (error.code === "PGRST116") {
          throw new Error(`Opportunity with ID ${opportunityIdNum} not found. The opportunity may not exist or may have been deleted.`);
        }
        
        throw error;
      }
      
      if (!data) {
        // Log available opportunities for debugging
        const { data: allOpportunities } = await (supabase
          .from("opportunities" as any)
          .select("id, title")
          .limit(10) as any);
        console.warn("Opportunity not found. Available opportunity IDs:", (allOpportunities as any[])?.map((o: any) => o.id) || []);
        throw new Error(`Opportunity with ID ${opportunityIdNum} not found`);
      }
      
      // Transform the nested structure
      const tags = ((data as any).tags || []).map((t: any) => t.tag).filter(Boolean);
      const sectorName = (data as any).sector?.name ?? null;

      // Transform snake_case to camelCase and add tags; pass sector name from join
      return {
        ...transformOpportunity({ ...data, tags, sector_name: sectorName }),
        tags,
      } as OpportunityWithTags;
    },
    enabled: !!opportunityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Check if user has a draft for this opportunity
  const { data: draft } = useOpportunityDraft(opportunityId ? parseInt(opportunityId) : undefined);

  // Check if user already has a submitted (non-draft) application for this opportunity
  const { data: existingApplication } = useQuery({
    queryKey: ["user-opportunity-application", user?.id, opportunityId],
    queryFn: async () => {
      if (!user || !opportunityId) return null;
      const { data, error } = await (supabase
        .from("applications")
        .select("id, status, is_draft")
        .eq("user_id", user.id)
        .eq("opportunity_id", parseInt(opportunityId))
        .eq("is_draft", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      if (error) {
        console.error("Error checking existing application:", error);
        return null;
      }
      return data;
    },
    enabled: !!user && !!opportunityId,
  });

  const hasSubmittedApplication = !!existingApplication;
  const hasApprovedApplication = existingApplication?.status === "approved";

  return {
    opportunity,
    isLoading,
    error: error as Error | null,
    draft,
    existingApplication: existingApplication as { id: string; status: string; is_draft: boolean } | null | undefined,
    hasSubmittedApplication,
    hasApprovedApplication,
  };
}









