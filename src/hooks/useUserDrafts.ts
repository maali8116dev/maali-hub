import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Draft {
  id: string;
  project_id?: number;
  opportunity_id?: number;
  organization_name: string | null;
  updated_at: string;
}

export const useUserDrafts = () => {
  return useQuery({
    queryKey: ["user-drafts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await (supabase
        .from("applications")
        .select("id, project_id, organization_name, updated_at")
        .eq("user_id", user.id)
        .eq("is_draft", true)
        .order("updated_at", { ascending: false }) as any);

      if (error) throw error;
      return (data || []) as Draft[];
    },
  });
};

export const useProjectDraft = (projectId: number | undefined) => {
  return useQuery({
    queryKey: ["project-draft", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("applications")
        .select("id, organization_name, updated_at")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("is_draft", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useOpportunityDraft = (opportunityId: number | undefined) => {
  return useQuery({
    queryKey: ["opportunity-draft", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("applications")
        .select("id, organization_name, updated_at")
        .eq("user_id", user.id)
        .eq("opportunity_id", opportunityId)
        .eq("is_draft", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!opportunityId,
  });
};
