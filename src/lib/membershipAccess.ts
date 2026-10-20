import type { Profile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const MEMBERSHIP_EXEMPT_ROLES = ["admin", "reviewer", "partner"] as const;

export type MembershipExemptRole = (typeof MEMBERSHIP_EXEMPT_ROLES)[number];

export function isMembershipExemptRole(
  role: Profile["role"] | string | undefined | null
): boolean {
  return (
    !!role &&
    MEMBERSHIP_EXEMPT_ROLES.includes(role as MembershipExemptRole)
  );
}

/** True when user has never finished first-time setup (no memberships row). */
export async function userNeedsOnboarding(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return (count ?? 0) === 0;
}
