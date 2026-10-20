import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PartnerOrgRole = "admin" | "member";

export interface PartnerOrg {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  sector: string;
  status: string;
  user_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_country: string | null;
  onboarding_dismissed_at: string | null;
  partnerRole: PartnerOrgRole | null;
}

const PARTNER_ORG_COLUMNS =
  "id, name, description, logo_url, website_url, sector, status, user_id, contact_name, contact_phone, contact_country, onboarding_dismissed_at";

export const PARTNER_ORG_NOT_LINKED_ERROR = "Partner organization not linked";

async function fetchPartnerOrgForUser(userId: string): Promise<PartnerOrg | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("partner_id, partner_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (profile?.partner_id) {
    const { data: org, error: orgError } = await supabase
      .from("partners")
      .select(PARTNER_ORG_COLUMNS)
      .eq("id", profile.partner_id)
      .maybeSingle();

    if (orgError) throw orgError;
    if (!org) return null;

    return {
      ...(org as Omit<PartnerOrg, "partnerRole">),
      partnerRole: (profile.partner_role as PartnerOrgRole | null) ?? "member",
    };
  }

  const { data: legacyOrg, error: legacyError } = await supabase
    .from("partners")
    .select(PARTNER_ORG_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  if (!legacyOrg) return null;

  return {
    ...(legacyOrg as Omit<PartnerOrg, "partnerRole">),
    partnerRole: "admin",
  };
}

export function usePartnerOrg() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["partner-org", user?.id],
    queryFn: () => fetchPartnerOrgForUser(user!.id),
    enabled: !!user,
  });
}

/** True when the signed-in user is linked to a partners row. */
export function usePartnerOrgLinked() {
  const query = usePartnerOrg();
  return {
    partnerOrg: query.data,
    isLinked: !!query.data?.id,
    isLoading: query.isLoading,
  };
}

export function useIsPartnerOrgAdmin() {
  const { data: partnerOrg } = usePartnerOrg();
  return partnerOrg?.partnerRole === "admin";
}

export function useUpdatePartnerOrg() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Partial<
        Pick<
          PartnerOrg,
          | "name"
          | "description"
          | "logo_url"
          | "website_url"
          | "sector"
          | "contact_name"
          | "contact_phone"
          | "contact_country"
          | "onboarding_dismissed_at"
        >
      >
    ) => {
      const org = await fetchPartnerOrgForUser(user!.id);
      if (!org?.id) throw new Error(PARTNER_ORG_NOT_LINKED_ERROR);
      if (org.partnerRole !== "admin") {
        throw new Error("Only partner org admins can update organization settings");
      }

      const { data, error } = await supabase
        .from("partners")
        .update(updates)
        .eq("id", org.id)
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
