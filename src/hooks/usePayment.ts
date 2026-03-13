import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  applicationId?: string;
  projectId?: number;
  description?: string;
}

interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  transactionId?: string;
}

/**
 * Hook to create a Stripe payment intent
 */
export function useCreatePaymentIntent() {
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: CreatePaymentIntentParams): Promise<CreatePaymentIntentResponse> => {
      if (!user) {
        throw new Error("User must be authenticated");
      }

      const response = await supabase.functions.invoke("create-payment-intent", {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create payment intent");
      }

      return response.data;
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to confirm a payment with Stripe
 */
export function useConfirmPayment() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const confirmPayment = async (
    clientSecret: string,
    paymentMethodId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsProcessing(true);
    try {
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

      if (!stripe) {
        throw new Error("Stripe failed to load");
      }

      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethodId,
      });

      if (confirmError) {
        return { success: false, error: confirmError.message || "Payment failed" };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment confirmation failed",
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    confirmPayment,
    isProcessing,
  };
}









