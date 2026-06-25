import { useState } from "react";
import { UpgradeMembershipModal } from "@/components/membership/UpgradeMembershipModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMembership, useInvalidateMembership } from "@/hooks/useMembership";
import { formatDate } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { invokeWithAuth } from "@/lib/invokeWithAuth";
import { PAYSTACK_CURRENCIES } from "@/lib/paymentProvider";
import { Zap, Users, Loader2, Calendar, CheckCircle2, AlertCircle, Clock } from "lucide-react";

function formatTierLabel(tier: string) {
  return tier === "member" ? "Full Member" : "Community";
}

function formatAmountCents(cents: number | null, currency = "USD") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function providerLabel(provider: string | null | undefined, billingCurrency: string | null | undefined) {
  if (provider === "paystack") {
    const cur = billingCurrency ?? "GHS";
    const display = PAYSTACK_CURRENCIES[cur as keyof typeof PAYSTACK_CURRENCIES]?.displayAmount;
    return display ? `Paystack (${cur} — ${display}/mo)` : `Paystack (${cur})`;
  }
  if (provider === "stripe") return "Stripe (USD)";
  return null;
}

const MembershipStatusBadge = ({
  tier,
  status,
  isExpired,
  canApply,
  cancelAtPeriodEnd,
}: {
  tier: string;
  status: string;
  isExpired: boolean;
  canApply: boolean;
  cancelAtPeriodEnd: boolean;
}) => {
  if (status === "pending_payment") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Payment pending
      </Badge>
    );
  }
  if (tier === "member" && cancelAtPeriodEnd) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">
        <Clock className="h-3 w-3 mr-1" />
        Cancels at period end
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
  const { toast } = useToast();
  const {
    membership,
    loading,
    isPaidMember,
    canApplyToOpportunities,
    isMembershipExpired,
    cancelAtPeriodEnd,
  } = useMembership();
  const invalidateMembership = useInvalidateMembership();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const paymentProvider = membership?.payment_provider ?? null;
  const billingCurrency = membership?.billing_currency ?? "USD";

  const tier = membership?.tier ?? "community";
  const status = membership?.status ?? "inactive";
  const showUpgrade =
    !loading &&
    (!membership || tier === "community" || isMembershipExpired || status === "pending_payment");

  const handleResumeMembership = async () => {
    setResuming(true);
    const { error } = await invokeWithAuth("resume-membership");
    setResuming(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateMembership();
      toast({
        title: "Membership resumed",
        description: "Your cancellation has been undone. Your membership will continue to renew automatically.",
      });
    }
  };

  const handleCancelMembership = async () => {
    setCancelling(true);
    const { error } = await invokeWithAuth("cancel-membership");
    setCancelling(false);
    setShowCancelDialog(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidateMembership();
      const endsOn = membership?.expires_at
        ? formatDate(membership.expires_at, "short")
        : null;
      toast({
        title: "Membership cancellation scheduled",
        description: endsOn
          ? `Your Full Member access continues until ${endsOn}. After that you'll be on the Community plan.`
          : "Your cancellation has been scheduled. You'll keep Full Member access until your billing period ends.",
      });
    }
  };

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
              Your Maali tier controls access to opportunity applications
            </CardDescription>
          </div>
          {!loading && (
            <MembershipStatusBadge
              tier={tier}
              status={status}
              isExpired={isMembershipExpired}
              canApply={canApplyToOpportunities}
              cancelAtPeriodEnd={cancelAtPeriodEnd}
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
                  <dt className="text-muted-foreground">
                    {cancelAtPeriodEnd ? "Access ends" : "Renews"}
                  </dt>
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
                  <dd className="font-medium mt-0.5">
                    {formatAmountCents(
                      membership.amount_paid,
                      paymentProvider === "paystack" ? billingCurrency : "USD",
                    )}
                  </dd>
                </div>
              )}
              {isPaidMember && providerLabel(paymentProvider, billingCurrency) && (
                <div>
                  <dt className="text-muted-foreground">Paid via</dt>
                  <dd className="font-medium mt-0.5">{providerLabel(paymentProvider, billingCurrency)}</dd>
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

        <div className="flex flex-wrap gap-2">
          {showUpgrade && (
            <Button
              variant={isMembershipExpired ? "default" : "hero"}
              onClick={() => setUpgradeOpen(true)}
            >
              {isMembershipExpired
                ? "Renew membership"
                : status === "pending_payment"
                  ? "Complete payment"
                  : "Upgrade to Full Member"}
            </Button>
          )}
          {isPaidMember && !cancelAtPeriodEnd && (
            <Button
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel membership
            </Button>
          )}
          {isPaidMember && cancelAtPeriodEnd && (
            <Button
              variant="outline"
              onClick={handleResumeMembership}
              disabled={resuming}
            >
              {resuming ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resuming…</>
              ) : (
                "Resume membership"
              )}
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Full Membership?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Full Member access continues until{" "}
              <span className="font-medium text-foreground">
                {membership?.expires_at ? formatDate(membership.expires_at, "short") : "the end of your billing period"}
              </span>
              . After that you'll be moved to the free Community plan — you can still browse
              opportunities and view your previous applications, but won't be able to submit new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep membership</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMembership}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelling…</>
              ) : (
                "Yes, cancel"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UpgradeMembershipModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </Card>
  );
}
