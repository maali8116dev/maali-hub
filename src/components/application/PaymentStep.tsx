import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { StripeElementsProvider } from "@/components/payment/StripeElementsProvider";
import { PaymentForm } from "@/components/payment/PaymentForm";
import { useCreatePaymentIntent } from "@/hooks/usePayment";
import { useToast } from "@/hooks/use-toast";

interface PaymentStepProps {
  projectId: number;
  applicationId?: string;
  onPaymentSuccess: () => void;
}

export function PaymentStep({ projectId, applicationId, onPaymentSuccess }: PaymentStepProps) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
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

  // Create payment intent when component mounts
  useEffect(() => {
    if (project?.application_fee && project.application_fee > 0 && !clientSecret && !paymentCompleted) {
      createPaymentIntent.mutate(
        {
          amount: project.application_fee,
          currency: "USD",
          applicationId: applicationId,
          projectId: projectId,
          description: `Application fee for ${project.title}`,
        },
        {
          onSuccess: (data) => {
            setClientSecret(data.clientSecret);
          },
          onError: (error) => {
            toast({
              title: "Payment Error",
              description: error.message || "Failed to initialize payment",
              variant: "destructive",
            });
          },
        }
      );
    }
  }, [project, clientSecret, paymentCompleted, applicationId, projectId, createPaymentIntent, toast]);

  const handlePaymentSuccess = () => {
    setPaymentCompleted(true);
    onPaymentSuccess();
    toast({
      title: "Payment Successful",
      description: "Your application fee has been paid successfully.",
    });
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
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

  // If no application fee, skip payment
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

  // If payment already completed
  if (paymentCompleted) {
    return (
      <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
        <AlertDescription className="text-green-800 dark:text-green-200">
          Payment completed successfully. You can proceed to review and submit your application.
        </AlertDescription>
      </Alert>
    );
  }

  // If creating payment intent
  if (createPaymentIntent.isPending || !clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Required
          </CardTitle>
          <CardDescription>
            Initializing secure payment...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show payment form
  return (
    <StripeElementsProvider clientSecret={clientSecret}>
      <PaymentForm
        clientSecret={clientSecret}
        amount={project.application_fee}
        currency="USD"
        description={`Application fee for ${project.title}`}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </StripeElementsProvider>
  );
}

