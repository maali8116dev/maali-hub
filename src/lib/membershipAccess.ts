import type { Profile } from "@/hooks/useProfile";

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
