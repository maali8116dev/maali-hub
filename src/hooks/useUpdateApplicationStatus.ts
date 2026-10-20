import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type ApplicationDecisionStatus = "approved" | "rejected";

type StatusUpdateResult = {
  success?: boolean;
  updatedCount?: number;
  error?: string;
  errorCode?: string;
};

function parseEdgeErrorBody(error: unknown): StatusUpdateResult | null {
  const rawBody = (error as { context?: { body?: unknown } } | undefined)?.context?.body;
  if (!rawBody) return null;
  try {
    if (typeof rawBody === "string") return JSON.parse(rawBody) as StatusUpdateResult;
    if (typeof rawBody === "object") return rawBody as StatusUpdateResult;
  } catch {
    return null;
  }
  return null;
}

export const useUpdateApplicationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationIds,
      status,
      reviewNotes,
    }: {
      applicationIds: string[];
      status: ApplicationDecisionStatus;
      reviewNotes?: string;
    }) => {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "admin_update_application_status" as never,
        {
          p_application_ids: applicationIds,
          p_status: status,
          p_review_notes: reviewNotes ?? null,
        } as never,
      );

      if (!rpcError) {
        const result = rpcData as StatusUpdateResult | null;
        if (result?.success) {
          return result;
        }
        if (result?.error) {
          throw new Error(result.error);
        }
      }

      const rpcMissing =
        rpcError?.message?.includes("admin_update_application_status") ||
        rpcError?.code === "PGRST202";

      if (!rpcMissing) {
        throw new Error(rpcError?.message || "Failed to update application status");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Session expired. Sign in again.");
      }

      const { data, error } = await supabase.functions.invoke("update-application-status", {
        body: {
          applicationIds,
          status,
          reviewNotes,
          token: session.access_token,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const edgeBody = parseEdgeErrorBody(error);
      if (error) {
        throw new Error(edgeBody?.error || error.message || "Edge function failed");
      }
      if (!data?.success) {
        throw new Error((data as StatusUpdateResult)?.error || "Failed to update application status");
      }
      return data as StatusUpdateResult;
    },
    onSuccess: (_data, variables) => {
      for (const id of variables.applicationIds) {
        queryClient.invalidateQueries({ queryKey: ["application", id] });
        queryClient.invalidateQueries({ queryKey: ["review-aggregation", id] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["project-applications-ranked"] });
    },
  });
};
