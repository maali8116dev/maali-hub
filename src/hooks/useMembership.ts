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
  stripe_subscription_id: string | null;
  payment_provider: "stripe" | "paystack" | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_payment_ref: string | null;
  paystack_email_token: string | null;
  billing_currency: string | null;
  cancel_at_period_end: boolean;
  amount_paid: number | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MEMBERSHIP_QUERY_KEY = (userId: string) => ["membership", userId];
export const MEMBERSHIP_ONBOARDING_KEY = (userId: string) =>
  ["membership-onboarding-complete", userId];

/** One row per user; prefer paid member over community / pending checkout. */
export function pickPrimaryMembership(rows: Membership[]): Membership | null {
  if (!rows.length) return null;
  const rank = (r: Membership) => {
    if (r.tier === "member" && r.status === "active") return 0;
    if (r.tier === "member" && r.status === "pending_payment") return 1;
    if (r.tier === "community" && r.status === "active") return 2;
    return 3;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b))[0];
}

export const useMembership = () => {
  const { user } = useAuth();

  const { data: membership = null, isPending: membershipPending } = useQuery({
    queryKey: user ? MEMBERSHIP_QUERY_KEY(user.id) : ["membership", null],
    queryFn: async () => {
      if (!user) return null;
      const { data: rows, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_payment"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return pickPrimaryMembership((rows as Membership[]) ?? []);
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds — short enough to catch webhook activations
  });

  const { data: hasCompletedOnboarding = false, isPending: onboardingCheckPending } =
    useQuery({
      queryKey: user ? MEMBERSHIP_ONBOARDING_KEY(user.id) : ["membership-onboarding-complete", null],
      queryFn: async () => {
        if (!user) return false;
        const { count, error } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (error) throw error;
        return (count ?? 0) > 0;
      },
      enabled: !!user,
      staleTime: 60 * 1000,
    });

  const isActiveMember = membership?.status === "active";
  const isPaidMember = isActiveMember && membership?.tier === "member";
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  const isMembershipExpired =
    expiresAt !== null && !Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date();
  const canApplyToOpportunities = isPaidMember && !isMembershipExpired;
  const cancelAtPeriodEnd = membership?.cancel_at_period_end ?? false;

  return {
    membership,
    loading: membershipPending || onboardingCheckPending,
    hasCompletedOnboarding,
    isActiveMember,
    isPaidMember,
    canApplyToOpportunities,
    isMembershipExpired,
    cancelAtPeriodEnd,
  };
};

/** Call this after inserting/activating a membership to sync all consumers instantly. */
export const useInvalidateMembership = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    if (!user) return;
    void queryClient.invalidateQueries({ queryKey: MEMBERSHIP_QUERY_KEY(user.id) });
    void queryClient.invalidateQueries({ queryKey: MEMBERSHIP_ONBOARDING_KEY(user.id) });
  };
};

/** After onboarding membership write — avoid dashboard → /onboarding race. */
export const useSyncMembershipAfterOnboarding = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return async () => {
    if (!user) return;
    queryClient.setQueryData(MEMBERSHIP_ONBOARDING_KEY(user.id), true);
    await queryClient.invalidateQueries({ queryKey: MEMBERSHIP_QUERY_KEY(user.id) });
    await queryClient.invalidateQueries({ queryKey: MEMBERSHIP_ONBOARDING_KEY(user.id) });
    await queryClient.refetchQueries({ queryKey: MEMBERSHIP_QUERY_KEY(user.id) });
    await queryClient.refetchQueries({ queryKey: MEMBERSHIP_ONBOARDING_KEY(user.id) });
  };
};
