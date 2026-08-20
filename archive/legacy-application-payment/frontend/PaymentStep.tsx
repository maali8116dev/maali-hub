import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApplicationFormStore } from "@/stores/applicationForm";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { useToast } from "@/hooks/use-toast";

interface PaymentStepProps {
  opportunityId: number;
  applicationId?: string;
  onPaymentSuccess: () => void;
}

export function PaymentStep({ opportunityId, applicationId, onPaymentSuccess }: PaymentStepProps) {
  const hasCalledSuccess = useRef(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const { updateFormData, formData } = useApplicationFormStore();
  const { toast } = useToast();

  const {
    data: applicationFee = 0,
    isLoading: isLoadingFee,
  } = usePlatformFee();

  // If already paid or no fee, auto-complete
  useEffect(() => {
    if (isLoadingFee) return;

    const noFee = !applicationFee || applicationFee === 0;
    const alreadyPaid = formData.paymentCompleted;

    if ((noFee || alreadyPaid) && !hasCalledSuccess.current) {
      hasCalledSuccess.current = true;
      onPaymentSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationFee, isLoadingFee, formData.paymentCompleted, onPaymentSuccess]);

  const redirectToCheckout = async () => {
    if (!applicationId) {
      toast({
        title: "Complete application first",
        description: "Submit your application; you will be redirected to pay after submitting.",
        variant: "destructive",
      });
      return;
    }
    setIsRedirecting(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          applicationId,
          opportunityId,
          successUrl: `${window.location.origin}/payment/success?application_id=${applicationId}`,
          cancelUrl: `${window.location.origin}/payment/cancel?application_id=${applicationId}`,
        },
      });

      if (error) {
        const body = (error as { context?: { body?: { error?: string } } })?.context?.body;
        const msg = body?.error || error.message || "Failed to start payment";
        setCheckoutError(msg);
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setCheckoutError("Could not open payment page. Please try again.");
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsRedirecting(false);
    }
  };

  if (isLoadingFee) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No fee required
  if (!applicationFee || applicationFee === 0) {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          This opportunity has no application fee. You can proceed to review and submit your application.
        </AlertDescription>
      </Alert>
    );
  }

  // Already paid
  if (formData.paymentCompleted || paymentComplete) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Payment completed successfully! You can proceed to review and submit your application.
        </AlertDescription>
      </Alert>
    );
  }

  // No application ID yet: tell user to submit first
  if (!applicationId) {
    return (
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
        <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Complete and submit your application. You will be redirected to the secure payment page to pay the application fee.
        </AlertDescription>
      </Alert>
    );
  }

  // Checkout error
  if (checkoutError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <p>{checkoutError}</p>
          <Button size="sm" variant="outline" onClick={redirectToCheckout} disabled={isRedirecting}>
            {isRedirecting ? "Opening…" : "Try again"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Pay via Stripe Checkout (redirect)
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Application fee: ${Number(applicationFee).toFixed(2)}. You will be redirected to our secure payment page.
        </p>
        <Button
          type="button"
          onClick={redirectToCheckout}
          disabled={isRedirecting}
          className="gap-2"
        >
          {isRedirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening payment page…
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pay application fee
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
