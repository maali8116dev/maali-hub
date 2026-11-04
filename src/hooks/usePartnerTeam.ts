import { usePartnerOrg, useIsPartnerOrgAdmin, type PartnerOrgRole } from "@/hooks/usePartnerOrg";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeWithAuth";
import type { PartnerTeamMember } from "@/lib/partnerTeam";

export function usePartnerTeam(partnerOrgId?: number) {
  return useQuery({
    queryKey: ["partner-team", partnerOrgId],
    queryFn: async () => {
      if (!partnerOrgId) return [];
      const { data, error } = await supabase.rpc("get_partner_team_members", {
        p_partner_id: partnerOrgId,
      });
      if (error) throw error;
      return (data || []) as PartnerTeamMember[];
    },
    enabled: !!partnerOrgId,
  });
}

export function useInvitePartnerTeamMember(partnerOrgId?: number) {
  const queryClient = useQueryClient();
  const { data: partnerOrg } = usePartnerOrg();

  return useMutation({
    mutationFn: async ({
      email,
      partnerRole = "member",
    }: {
      email: string;
      partnerRole?: PartnerOrgRole;
    }) => {
      const orgId = partnerOrgId ?? partnerOrg?.id;
      if (!orgId) throw new Error("Partner organization not found");

      const { data, error } = await invokeWithAuth<{ userId: string }>("invite-partner", {
        email,
        partnerOrgName: partnerOrg?.name ?? "Partner organization",
        partnerOrgId: orgId,
        partnerRole,
      });
      if (error) throw new Error(error.message || "Invite failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-team", partnerOrgId ?? partnerOrg?.id] });
    },
  });
}

export function useUpdatePartnerTeamMemberRole(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: PartnerOrgRole;
    }) => {
      const { error } = await supabase.rpc("update_partner_team_member_role", {
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-team", partnerOrgId] });
    },
  });
}

export function useRemovePartnerTeamMember(partnerOrgId?: number) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("remove_partner_team_member", {
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-team", partnerOrgId] });
      queryClient.invalidateQueries({ queryKey: ["partner-org", user?.id] });
    },
  });
}

export function useLinkPartnerTeamMember(partnerOrgId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role = "member",
    }: {
      userId: string;
      role?: PartnerOrgRole;
    }) => {
      if (!partnerOrgId) throw new Error("Partner organization not found");
      const { error } = await supabase.rpc("link_partner_team_member", {
        p_partner_id: partnerOrgId,
        p_user_id: userId,
        p_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-team", partnerOrgId] });
    },
  });
}

export { useIsPartnerOrgAdmin };
