import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import PaystackPop from "@paystack/inline-js";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import { seedDefaultBillingAddress } from "@/lib/seedBillingAddress";
import {
  type PaymentProviderChoice,
  isCheckoutChoiceComplete,
  PAYSTACK_CURRENCIES,
} from "@/lib/paymentProvider";
import { PaymentProviderPicker } from "@/components/membership/PaymentProviderPicker";
import { useLockedPaymentProvider } from "@/hooks/useLockedPaymentProvider";
import type { PaystackCurrency } from "@/lib/paymentProvider";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

type StripeFormProps = {
  userId: string;
  billingEmail: string;
  onBillingEmailChange?: (email: string) => void;
  payLabel: string;
  onSuccess: () => void;
  onBack?: () => void;
  showBillingEmail?: boolean;
};

const StripePaymentForm = ({
  userId,
  billingEmail,
  onBillingEmailChange,
  payLabel,
  onSuccess,
  onBack,
  showBillingEmail = true,
}: StripeFormProps) => {
  const { t } = useTranslation("common");
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? t("onboarding.payment.failed"));
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard?upgrade_pending=1` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? t("onboarding.payment.failed"));
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      await seedDefaultBillingAddress({ userId, billingEmail });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {showBillingEmail && (
        <div className="space-y-2">
          <Label htmlFor="billing-email" className="text-sm font-medium">
            {t("onboarding.payment.billingEmail")}
          </Label>
          <Input
            id="billing-email"
            type="email"
            value={billingEmail}
            onChange={(e) => onBillingEmailChange?.(e.target.value)}
            placeholder={t("onboarding.payment.billingEmailPlaceholder")}
            className="h-11"
          />
        </div>
      )}
      <div className="rounded-lg border border-border p-4 bg-card">
        <PaymentElement />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
            {t("onboarding.payment.back")}
          </Button>
        )}
        <Button type="submit" variant="hero" className="flex-1" disabled={!stripe || processing}>
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("onboarding.payment.processing")}
            </>
          ) : (
            payLabel
          )}
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">{t("onboarding.payment.stripeNote")}</p>
    </form>
  );
};

type PaystackCheckoutProps = {
  accessCode: string;
  reference: string;
  displayAmount: string;
  currency: string;
  onSuccess: () => void;
  onBack?: () => void;
  onExternalCheckoutChange?: (active: boolean) => void;
};

const PaystackCheckout = ({
  accessCode,
  reference,
  displayAmount,
  currency,
  onSuccess,
  onBack,
  onExternalCheckoutChange,
}: PaystackCheckoutProps) => {
  const { t } = useTranslation("common");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  const endExternalCheckout = () => onExternalCheckoutChange?.(false);

  const openPopup = () => {
    if (!publicKey) {
      setError(t("payment.provider.paystackNotConfigured"));
      return;
    }
    setProcessing(true);
    setError(null);
    onExternalCheckoutChange?.(true);
    // Radix Dialog locks body scroll — release so Paystack overlay can scroll.
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    document.documentElement.style.overflow = "";
    document.body.removeAttribute("data-scroll-locked");

    const popup = new PaystackPop();
    popup.resumeTransaction(accessCode, {
      key: publicKey,
      onSuccess: (txn?: { reference?: string }) => {
        void invokeWithAuth("verify-paystack-payment", {
          reference: txn?.reference ?? reference,
        }).finally(() => {
          setProcessing(false);
          endExternalCheckout();
          onSuccess();
        });
      },
      onCancel: () => {
        setProcessing(false);
        endExternalCheckout();
      },
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t("payment.provider.paystackAmount", { amount: displayAmount, currency })}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
            {t("onboarding.payment.back")}
          </Button>
        )}
        <Button type="button" variant="hero" className="flex-1" onClick={openPopup} disabled={processing}>
          {processing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("onboarding.payment.processing")}
            </>
          ) : (
            t("payment.provider.payWithPaystack")
          )}
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">{t("payment.provider.paystackFooter")}</p>
    </div>
  );
};

export type MembershipPaymentStepProps = {
  userId: string;
  billingEmail: string;
  choice: PaymentProviderChoice;
  onChoiceChange: (choice: PaymentProviderChoice) => void;
  onSuccess: () => void;
  onBack?: () => void;
  /** Hide picker when provider locked */
  hidePicker?: boolean;
  defaultPaystackCurrency?: PaystackCurrency;
  payLabelStripe?: string;
  title?: string;
  description?: string;
  showBillingEmail?: boolean;
  onBillingEmailChange?: (email: string) => void;
  /** Fired when Paystack inline popup opens/closes (parent can disable modal scroll lock). */
  onExternalCheckoutChange?: (active: boolean) => void;
};

export function MembershipPaymentStep({
  userId,
  billingEmail,
  choice,
  onChoiceChange,
  onSuccess,
  onBack,
  hidePicker = false,
  defaultPaystackCurrency = "GHS",
  payLabelStripe,
  title,
  description,
  showBillingEmail = true,
  onBillingEmailChange,
  onExternalCheckoutChange,
}: MembershipPaymentStepProps) {
  const { t } = useTranslation("common");
  const { lockedProvider, loading: lockLoading } = useLockedPaymentProvider();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paystackSession, setPaystackSession] = useState<{
    accessCode: string;
    reference: string;
    displayAmount: string;
    currency: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  // Provider is only initialized after explicit confirm — prevents Stripe firing
  // by default (and locking the membership) before the user chooses.
  const [started, setStarted] = useState(false);

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const effectiveChoice: PaymentProviderChoice = lockedProvider
    ? lockedProvider === "paystack"
      ? { provider: "paystack", currency: (choice.currency ?? defaultPaystackCurrency) as PaystackCurrency }
      : { provider: "stripe" }
    : choice;

  // Locked membership has no choice to make — start immediately.
  useEffect(() => {
    if (lockedProvider && !lockLoading) setStarted(true);
  }, [lockedProvider, lockLoading]);

  const handleChoiceChange = (next: PaymentProviderChoice) => {
    setStarted(false);
    setClientSecret(null);
    setPaystackSession(null);
    setFetchError(null);
    onChoiceChange(next);
  };

  const readyToInit =
    isCheckoutChoiceComplete(effectiveChoice) && !lockLoading && started;

  useEffect(() => {
    if (!readyToInit) return;

    let cancelled = false;
    setInitializing(true);
    setFetchError(null);
    setClientSecret(null);
    setPaystackSession(null);

    const init = async () => {
      if (effectiveChoice.provider === "stripe") {
        const { data, error } = await invokeWithAuth<{
          clientSecret?: string;
          alreadyActive?: boolean;
          error?: string;
        }>("create-membership-payment", { provider: "stripe" });

        if (cancelled) return;
        if (data?.alreadyActive) {
          onSuccessRef.current();
          return;
        }
        if (error || !data?.clientSecret) {
          const parsed = error ? await parseEdgeFunctionError(error) : null;
          const msg = data?.error || parsed || error?.message || t("error");
          setFetchError(t("onboarding.payment.initFailed", { message: msg }));
        } else {
          setClientSecret(data.clientSecret);
        }
      } else {
        const { data, error } = await invokeWithAuth<{
          accessCode?: string;
          reference?: string;
          displayAmount?: string;
          currency?: string;
          error?: string;
        }>("create-paystack-membership-payment", { currency: effectiveChoice.currency });

        if (cancelled) return;
        if (error || !data?.accessCode) {
          const parsed = error ? await parseEdgeFunctionError(error) : null;
          const msg = data?.error || parsed || error?.message || t("error");
          setFetchError(t("onboarding.payment.initFailed", { message: msg }));
        } else {
          setPaystackSession({
            accessCode: data.accessCode,
            reference: data.reference ?? "",
            displayAmount: data.displayAmount ?? PAYSTACK_CURRENCIES[effectiveChoice.currency!].displayAmount,
            currency: data.currency ?? effectiveChoice.currency!,
          });
        }
      }
      setInitializing(false);
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [readyToInit, effectiveChoice.provider, effectiveChoice.currency, t]);

  const payLabel =
    payLabelStripe ?? t("onboarding.payment.payAndJoin");

  return (
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}
      {description && <p className="text-muted-foreground">{description}</p>}

      {!hidePicker && !lockedProvider && (
        <PaymentProviderPicker
          value={choice}
          onChange={handleChoiceChange}
          defaultPaystackCurrency={defaultPaystackCurrency}
        />
      )}

      {lockedProvider && (
        <p className="text-xs text-muted-foreground">
          {t("payment.provider.locked", { provider: lockedProvider })}
        </p>
      )}

      {!isCheckoutChoiceComplete(effectiveChoice) && !lockedProvider ? (
        <p className="text-sm text-muted-foreground">{t("payment.provider.completeChoice")}</p>
      ) : !started ? (
        <div className="flex gap-3">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              {t("onboarding.payment.back")}
            </Button>
          )}
          <Button
            type="button"
            variant="hero"
            className="flex-1"
            onClick={() => setStarted(true)}
          >
            {t("payment.provider.continueToPayment")}
          </Button>
        </div>
      ) : fetchError ? (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{fetchError}</p>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              {t("onboarding.payment.goBack")}
            </Button>
          )}
        </div>
      ) : initializing || lockLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : effectiveChoice.provider === "stripe" && clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripePaymentForm
            userId={userId}
            billingEmail={billingEmail}
            onBillingEmailChange={onBillingEmailChange}
            payLabel={payLabel}
            onSuccess={onSuccess}
            onBack={onBack}
            showBillingEmail={showBillingEmail}
          />
        </Elements>
      ) : effectiveChoice.provider === "paystack" && paystackSession ? (
        <PaystackCheckout
          accessCode={paystackSession.accessCode}
          reference={paystackSession.reference}
          displayAmount={paystackSession.displayAmount}
          currency={paystackSession.currency}
          onSuccess={onSuccess}
          onBack={onBack}
          onExternalCheckoutChange={onExternalCheckoutChange}
        />
      ) : null}
    </div>
  );
}
