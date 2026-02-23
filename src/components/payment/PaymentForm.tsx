import { useState, useEffect } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  currency?: string;
  onSuccess: () => void;
  onError?: (error: string) => void;
  description?: string;
}

export function PaymentForm({
  clientSecret,
  amount,
  currency = "USD",
  onSuccess,
  onError,
  description,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe) {
      return;
    }

    const clientSecretParam = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );

    if (!clientSecretParam) {
      return;
    }

    stripe.retrievePaymentIntent(clientSecretParam).then(({ paymentIntent }) => {
      switch (paymentIntent?.status) {
        case "succeeded":
          setMessage("Payment succeeded!");
          onSuccess();
          break;
        case "processing":
          setMessage("Your payment is processing.");
          break;
        case "requires_payment_method":
          setMessage("Your payment was not successful, please try again.");
          break;
        default:
          setMessage("Something went wrong.");
          break;
      }
    });
  }, [stripe, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/applications?payment=success`,
      },
      redirect: "if_required",
    });

    if (error) {
      const errorMessage = error.message || "Payment failed";
      setMessage(errorMessage);
      onError?.(errorMessage);
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } else if (paymentIntent?.status === "succeeded") {
      setMessage("Payment succeeded!");
      onSuccess();
    } else {
      setMessage("Processing payment...");
    }

    setIsProcessing(false);
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Information
        </CardTitle>
        <CardDescription>
          {description || `Complete your payment of ${formatAmount(amount, currency)}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
          
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.includes("succeeded") || message.includes("processing")
                  ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={isProcessing || !stripe || !elements}
            className="w-full min-h-[44px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ${formatAmount(amount, currency)}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

