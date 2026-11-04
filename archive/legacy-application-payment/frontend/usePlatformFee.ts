import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_ID = 1;

export function usePlatformFee() {
  return useQuery({
    queryKey: ["platform-settings", "application-fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings" as any)
        .select("application_fee")
        .eq("id", SETTINGS_ID)
        .maybeSingle();

      if (error) throw error;
      return data?.application_fee ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlatformFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationFee: number) => {
      const { error } = await supabase
        .from("platform_settings" as any)
        .upsert(
          {
            id: SETTINGS_ID,
            application_fee: applicationFee,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings", "application-fee"] });
    },
  });
}
