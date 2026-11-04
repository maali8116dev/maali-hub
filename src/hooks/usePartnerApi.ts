import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import type { PartnerApiScope, PartnerWebhookEvent } from "@/lib/partnerApiConstants";

export type PartnerApiKeyRow = {
  id: string;
  key_prefix: string;
  scopes: string[];
  environment: "test" | "live";
  last_used_at: string | null;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
};

export type PartnerWebhookConfig = {
  endpointUrl: string | null;
  subscribedEvents: string[];
  secretPrefix: string | null;
  updatedAt: string | null;
  signingSecret?: string;
};

type ManagePartnerApiResponse<T> = { data?: T; error?: string };

async function invokeManagePartnerApi<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await invokeWithAuth<ManagePartnerApiResponse<T>>(
    "manage-partner-api",
    body,
  );

  if (error) {
    const parsed = await parseEdgeFunctionError(error);
    throw new Error(parsed || error.message || "Request failed");
  }

  if (data?.error) throw new Error(data.error);
  if (data?.data === undefined) throw new Error("Empty response");
  return data.data;
}

export function usePartnerApiKeys(partnerOrgId?: number) {
  return useQuery({
    queryKey: ["partner-api-keys", partnerOrgId],
    queryFn: () => invokeManagePartnerApi<PartnerApiKeyRow[]>({ action: "list_keys" }),
    enabled: !!partnerOrgId,
  });
}

export function usePartnerWebhook(partnerOrgId?: number) {
  return useQuery({
    queryKey: ["partner-webhook", partnerOrgId],
    queryFn: () => invokeManagePartnerApi<PartnerWebhookConfig | null>({ action: "get_webhook" }),
    enabled: !!partnerOrgId,
  });
}

export function useCreatePartnerApiKey(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      environment: "test" | "live";
      scopes: PartnerApiScope[];
      days?: number;
    }) =>
      invokeManagePartnerApi<PartnerApiKeyRow & { apiKey: string }>({
        action: "create_key",
        environment: input.environment,
        scopes: input.scopes,
        days: input.days ?? 365,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-api-keys", partnerOrgId] });
    },
  });
}

export function useRevokePartnerApiKey(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) =>
      invokeManagePartnerApi<{ id: string }>({ action: "revoke_key", keyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-api-keys", partnerOrgId] });
    },
  });
}

export function useSavePartnerWebhook(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      endpointUrl: string;
      subscribedEvents: PartnerWebhookEvent[];
    }) =>
      invokeManagePartnerApi<PartnerWebhookConfig>({
        action: "save_webhook",
        endpointUrl: input.endpointUrl,
        subscribedEvents: input.subscribedEvents,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-webhook", partnerOrgId] });
    },
  });
}

export function useRotatePartnerWebhookSecret(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      invokeManagePartnerApi<{ secretPrefix: string; signingSecret: string }>({
        action: "rotate_webhook_secret",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-webhook", partnerOrgId] });
    },
  });
}
