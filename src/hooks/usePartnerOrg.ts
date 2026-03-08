import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PartnerOrg {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  category: string;
  status: string;
  user_id: string | null;
}

export function usePartnerOrg() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-org", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, description, logo_url, website_url, category, status, user_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PartnerOrg | null;
    },
    enabled: !!user,
  });
}

export function useUpdatePartnerOrg() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<PartnerOrg, "description" | "logo_url" | "website_url">>) => {
      const { data, error } = await supabase
        .from("partners")
        .update(updates)
        .eq("user_id", user!.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-org", user?.id] });
    },
  });
}
