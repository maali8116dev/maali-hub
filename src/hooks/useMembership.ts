import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MembershipTier = "community" | "member";
export type MembershipStatus = "active" | "inactive" | "pending_payment";

export interface Membership {
  id: string;
  user_id: string;
  tier: MembershipTier;
  status: MembershipStatus;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_paid: number | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MEMBERSHIP_QUERY_KEY = (userId: string) => ["membership", userId];

export const useMembership = () => {
  const { user } = useAuth();

  const { data: membership = null, isPending } = useQuery({
    queryKey: user ? MEMBERSHIP_QUERY_KEY(user.id) : ["membership", null],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as Membership | null) ?? null;
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds — short enough to catch webhook activations
  });

  const isActiveMember = membership?.status === "active";
  const isPaidMember = isActiveMember && membership?.tier === "member";
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  const isMembershipExpired =
    expiresAt !== null && !Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date();
  const canApplyToOpportunities = isPaidMember && !isMembershipExpired;

  return {
    membership,
    loading: isPending,
    isActiveMember,
    isPaidMember,
    canApplyToOpportunities,
    isMembershipExpired,
  };
};

/** Call this after inserting/activating a membership to sync all consumers instantly. */
export const useInvalidateMembership = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: MEMBERSHIP_QUERY_KEY(user.id) });
    }
  };
};
