import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMembership } from "@/hooks/useMembership";
import { formatDate } from "@/lib/dateUtils";
import { Zap, Users, Loader2, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

function formatTierLabel(tier: string) {
  return tier === "member" ? "Full Member" : "Community";
}

function formatAmountCents(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const MembershipStatusBadge = ({
  tier,
  status,
  isExpired,
  canApply,
}: {
  tier: string;
  status: string;
  isExpired: boolean;
  canApply: boolean;
}) => {
  if (status === "pending_payment") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Payment pending
      </Badge>
    );
  }
  if (tier === "member" && canApply) {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Active — can apply
      </Badge>
    );
  }
  if (tier === "member" && isExpired) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
        <AlertCircle className="h-3 w-3 mr-1" />
        Expired
      </Badge>
    );
  }
  if (tier === "community" && status === "active") {
    return (
      <Badge variant="secondary">
        <Users className="h-3 w-3 mr-1" />
        Community — browse only
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      {status === "inactive" ? "Inactive" : "No membership"}
    </Badge>
  );
};

export function MembershipProfileSection() {
  const navigate = useNavigate();
  const {
    membership,
    loading,
    isPaidMember,
    canApplyToOpportunities,
    isMembershipExpired,
  } = useMembership();

  const tier = membership?.tier ?? "community";
  const status = membership?.status ?? "inactive";
  const showUpgrade =
    !loading &&
    (!membership || tier === "community" || isMembershipExpired || status === "pending_payment");

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              {tier === "member" ? (
                <Zap className="h-5 w-5 text-primary" />
              ) : (
                <Users className="h-5 w-5 text-muted-foreground" />
              )}
              Membership
            </CardTitle>
            <CardDescription className="mt-1">
              Your MAALI tier controls access to funding applications
            </CardDescription>
          </div>
          {!loading && (
            <MembershipStatusBadge
              tier={tier}
              status={status}
              isExpired={isMembershipExpired}
              canApply={canApplyToOpportunities}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading membership…
          </div>
        ) : membership ? (
          <>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium mt-0.5">{formatTierLabel(membership.tier)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium mt-0.5 capitalize">{membership.status.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Member since
                </dt>
                <dd className="font-medium mt-0.5">{formatDate(membership.starts_at, "short") || "—"}</dd>
              </div>
              {isPaidMember && (
                <div>
                  <dt className="text-muted-foreground">Renews / expires</dt>
                  <dd className="font-medium mt-0.5">
                    {membership.expires_at
                      ? formatDate(membership.expires_at, "short")
                      : "No expiry set"}
                  </dd>
                </div>
              )}
              {membership.amount_paid != null && membership.tier === "member" && (
                <div>
                  <dt className="text-muted-foreground">Last payment</dt>
                  <dd className="font-medium mt-0.5">{formatAmountCents(membership.amount_paid)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Apply to opportunities</dt>
                <dd className="font-medium mt-0.5">
                  {canApplyToOpportunities ? "Yes" : "Full Member required"}
                </dd>
              </div>
            </dl>

            {tier === "community" && status === "active" && (
              <p className="text-sm text-muted-foreground">
                Upgrade to Full Member ($2/month) to submit applications for funding opportunities.
              </p>
            )}
            {isMembershipExpired && (
              <p className="text-sm text-destructive">
                Your Full Member access has expired. Renew to apply again.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You are on the free Community tier. Join or upgrade to apply for opportunities.
          </p>
        )}

        {showUpgrade && (
          <Button
            variant={isMembershipExpired ? "default" : "hero"}
            onClick={() => navigate("/join")}
          >
            {isMembershipExpired
              ? "Renew membership"
              : status === "pending_payment"
                ? "Complete payment"
                : "Upgrade to Full Member"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
