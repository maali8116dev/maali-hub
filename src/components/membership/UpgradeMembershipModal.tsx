import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateMembership } from "@/hooks/useMembership";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import i18n from "@/lib/i18n";
import { MembershipPaymentStep } from "@/components/membership/MembershipPaymentStep";
import {
  getDefaultPaystackCurrency,
  type PaymentProviderChoice,
} from "@/lib/paymentProvider";
import { useLockedPaymentProvider } from "@/hooks/useLockedPaymentProvider";

const UpgradeSuccess = ({ onClose }: { onClose: () => void }) => (
  <div className="flex flex-col items-center text-center space-y-4 py-4">
    <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
      <Check className="h-7 w-7 text-success" />
    </div>
    <div>
      <h3 className="text-lg font-semibold">You're a Full Member!</h3>
      <p className="text-sm text-muted-foreground mt-1">
        You can now apply to funding opportunities, jobs, internships, and fellowships.
      </p>
    </div>
    <Button variant="hero" className="w-full" onClick={onClose}>
      Start applying
    </Button>
  </div>
);

export function UpgradeMembershipModal({
  open,
  onClose,
  countryHint,
}: {
  open: boolean;
  onClose: () => void;
  countryHint?: string | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const invalidateMembership = useInvalidateMembership();
  const { lockedProvider } = useLockedPaymentProvider();
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);
  const [externalCheckout, setExternalCheckout] = useState(false);
  const [choice, setChoice] = useState<PaymentProviderChoice>({
    provider: lockedProvider ?? "stripe",
    currency: getDefaultPaystackCurrency(countryHint),
  });

  useEffect(() => {
    if (open) {
      setActivating(false);
      setDone(false);
      setExternalCheckout(false);
      setChoice({
        provider: lockedProvider ?? "stripe",
        currency: getDefaultPaystackCurrency(countryHint),
      });
    }
  }, [open, lockedProvider, countryHint]);

  const waitForActivation = async () => {
    if (!user) return;
    setActivating(true);
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      invalidateMembership();
      const { data: rows } = await supabase
        .from("memberships")
        .select("status, tier")
        .eq("user_id", user.id)
        .in("status", ["active", "pending_payment"])
        .eq("tier", "member")
        .order("updated_at", { ascending: false })
        .limit(1);
      const data = rows?.[0]?.status === "active" ? rows[0] : null;
      if (data) {
        setActivating(false);
        setDone(true);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setActivating(false);
    invalidateMembership();
    toast({
      title: i18n.t("onboarding.toasts.activationPending.title", { ns: "common" }),
      description: i18n.t("onboarding.toasts.activationPending.description", { ns: "common" }),
    });
    onClose();
  };

  const handleClose = () => {
    if (done) invalidateMembership();
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={open} modal={!externalCheckout} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className="sm:max-w-md max-h-[90dvh] overflow-y-auto top-[5%] sm:top-[50%] translate-y-0 sm:-translate-y-1/2"
        onInteractOutside={(e) => { if (externalCheckout) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (externalCheckout) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Upgrade to Full Member</DialogTitle>
          {!done && (
            <DialogDescription>
              Full Member — <span className="font-semibold text-foreground">$2 / month</span> (or local equivalent via Paystack). Cancel anytime.
            </DialogDescription>
          )}
        </DialogHeader>

        {done ? (
          <UpgradeSuccess onClose={handleClose} />
        ) : activating ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Activating your membership…</p>
          </div>
        ) : (
          <MembershipPaymentStep
            userId={user.id}
            billingEmail={user.email ?? ""}
            choice={choice}
            onChoiceChange={setChoice}
            onSuccess={waitForActivation}
            onBack={handleClose}
            defaultPaystackCurrency={getDefaultPaystackCurrency(countryHint)}
            payLabelStripe="Pay $2 & Upgrade"
            showBillingEmail
            onExternalCheckoutChange={setExternalCheckout}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
