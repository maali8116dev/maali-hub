import { useState, useEffect } from "react";
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

export const useMembership = () => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMembership(null);
      setLoading(false);
      return;
    }

    supabase
      .from("memberships")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setMembership(data as Membership | null);
        setLoading(false);
      });
  }, [user]);

  const isActiveMember = membership?.status === "active";
  const isPaidMember = isActiveMember && membership?.tier === "member";

  return { membership, loading, isActiveMember, isPaidMember };
};
