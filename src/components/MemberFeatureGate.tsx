import { useMembership } from "@/hooks/useMembership";
import { useProfile } from "@/hooks/useProfile";
import { MembershipRequiredBanner } from "@/components/MembershipRequiredBanner";
import { isMembershipExemptRole } from "@/lib/membershipAccess";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

interface MemberFeatureGateProps {
  children: React.ReactNode;
}

/** Blocks Community (free) members from Full Member-only dashboard features. */
export function MemberFeatureGate({ children }: MemberFeatureGateProps) {
  const { canApplyToOpportunities, loading: membershipLoading } = useMembership();
  const { data: profile, isPending: profilePending } = useProfile();
  const { t } = useTranslation(["dashboard"]);

  const loading = membershipLoading || profilePending;
  const hasAccess =
    canApplyToOpportunities || isMembershipExemptRole(profile?.role);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <MembershipRequiredBanner
        title={t("dashboard:memberGate.title")}
        description={t("dashboard:memberGate.description")}
      />
    );
  }

  return <>{children}</>;
}
