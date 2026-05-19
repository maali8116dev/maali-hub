import { describe, it, expect } from "vitest";

/** Mirrors useMembership canApplyToOpportunities logic for unit tests */
function canApplyToOpportunities(membership: {
  status: string;
  tier: string;
  expires_at: string | null;
} | null): boolean {
  if (!membership || membership.status !== "active" || membership.tier !== "member") {
    return false;
  }
  if (!membership.expires_at) return true;
  const expiresAt = new Date(membership.expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt > new Date();
}

describe("canApplyToOpportunities", () => {
  it("allows active full member with future expiry", () => {
    expect(
      canApplyToOpportunities({
        status: "active",
        tier: "member",
        expires_at: "2099-12-31T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("blocks community tier", () => {
    expect(
      canApplyToOpportunities({
        status: "active",
        tier: "community",
        expires_at: null,
      }),
    ).toBe(false);
  });

  it("blocks expired full member", () => {
    expect(
      canApplyToOpportunities({
        status: "active",
        tier: "member",
        expires_at: "2020-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});
