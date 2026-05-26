import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInvalidateMembership } from "@/hooks/useMembership";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import { seedDefaultBillingAddress } from "@/lib/seedBillingAddress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// ─── Inner payment form (must be inside <Elements>) ──────────────────────────

const UpgradePaymentForm = ({
  userId,
  billingEmail: initialEmail,
  onSuccess,
  onClose,
}: {
  userId: string;
  billingEmail: string;
  onSuccess: () => void;
  onClose: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState(initialEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard?upgrade_pending=1` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      await seedDefaultBillingAddress({ userId, billingEmail });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="upgrade-billing-email" className="text-sm font-medium">
          Billing email for receipts
        </Label>
        <Input
          id="upgrade-billing-email"
          type="email"
          value={billingEmail}
          onChange={(e) => setBillingEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11"
        />
      </div>
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" variant="hero" className="flex-1" disabled={!stripe || processing}>
          {processing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            "Pay $2 & Upgrade"
          )}
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Payments are processed securely by Stripe. MAALI never stores your card details.
      </p>
    </form>
  );
};

// ─── Step: load client secret, then render form ───────────────────────────────

const UpgradePaymentStep = ({
  userId,
  billingEmail,
  onSuccess,
  onClose,
}: {
  userId: string;
  billingEmail: string;
  onSuccess: () => void;
  onClose: () => void;
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    invokeWithAuth<{ clientSecret?: string; alreadyActive?: boolean; error?: string }>(
      "create-membership-payment"
    ).then(({ data, error }) => {
      if (data?.alreadyActive) {
        onSuccess();
        return;
      }
      if (error || !data?.clientSecret) {
        const msg =
          data?.error || parseEdgeFunctionError(error) || error?.message || "Unknown error";
        setFetchError(`Could not initialise payment: ${msg}`);
      } else {
        setClientSecret(data.clientSecret);
      }
    });
  }, []);

  if (fetchError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <UpgradePaymentForm
        userId={userId}
        billingEmail={billingEmail}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    </Elements>
  );
};

// ─── Success view ─────────────────────────────────────────────────────────────

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

// ─── Public component ─────────────────────────────────────────────────────────

export function UpgradeMembershipModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const invalidateMembership = useInvalidateMembership();
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActivating(false);
      setDone(false);
    }
  }, [open]);

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
      title: "Payment received — activation pending",
      description:
        "Your payment went through but we haven't received Stripe's confirmation yet. Refresh in a minute, or contact support if this persists.",
    });
    onClose();
  };

  const handleClose = () => {
    if (done) invalidateMembership();
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Full Member</DialogTitle>
          {!done && (
            <DialogDescription>
              Full Member — <span className="font-semibold text-foreground">$2 / month</span>. Cancel anytime.
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
          <UpgradePaymentStep
            userId={user.id}
            billingEmail={user.email ?? ""}
            onSuccess={waitForActivation}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
