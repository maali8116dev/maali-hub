import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useCreatePaymentIntent } from "@/hooks/usePayment";
import { StripeElementsProvider } from "@/components/payment/StripeElementsProvider";
import { PaymentForm } from "@/components/payment/PaymentForm";
import { useApplicationFormStore } from "@/stores/applicationForm";

interface PaymentStepProps {
  projectId: number;
  applicationId?: string;
  onPaymentSuccess: () => void;
}

export function PaymentStep({ projectId, applicationId, onPaymentSuccess }: PaymentStepProps) {
  const hasCalledSuccess = useRef(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const { updateFormData, formData } = useApplicationFormStore();
  const createPaymentIntent = useCreatePaymentIntent();

  // Fetch project to get application fee
  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, application_fee")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // If already paid or no fee, auto-complete
  useEffect(() => {
    if (!project || isLoadingProject) return;
    
    const noFee = !project.application_fee || project.application_fee === 0;
    const alreadyPaid = formData.paymentCompleted;
    
    if ((noFee || alreadyPaid) && !hasCalledSuccess.current) {
      hasCalledSuccess.current = true;
      onPaymentSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, isLoadingProject]);

  // Create payment intent when fee exists and not yet paid
  useEffect(() => {
    if (!project || !project.application_fee || project.application_fee === 0) return;
    if (formData.paymentCompleted || clientSecret) return;

    // application_fee is stored in dollars in the database
    const feeInDollars = project.application_fee;

    createPaymentIntent.mutate(
      {
        amount: feeInDollars,
        currency: "usd",
        applicationId,
        projectId,
        description: `Application fee for ${project.title || "project"}`,
      },
      {
        onSuccess: (data) => {
          setClientSecret(data.clientSecret);
          updateFormData({ paymentIntentId: data.paymentIntentId });
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const handlePaymentSuccess = () => {
    setPaymentComplete(true);
    updateFormData({ paymentCompleted: true });
    onPaymentSuccess();
  };

  if (isLoadingProject) {
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
  if (!project?.application_fee || project.application_fee === 0) {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
        <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          This project has no application fee. You can proceed to review and submit your application.
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

  // Creating payment intent
  if (createPaymentIntent.isPending || !clientSecret) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Setting up payment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Payment intent creation failed
  if (createPaymentIntent.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to initialize payment. Please try again or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  const feeInDollars = project.application_fee;

  // Show Stripe payment form
  return (
    <StripeElementsProvider clientSecret={clientSecret}>
      <PaymentForm
        clientSecret={clientSecret}
        amount={feeInDollars}
        currency="USD"
        onSuccess={handlePaymentSuccess}
        description={`Application fee for ${project.title || "this project"}`}
      />
    </StripeElementsProvider>
  );
}
