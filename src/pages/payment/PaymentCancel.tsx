import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PaymentCancelContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const applicationId = searchParams.get("application_id");
  const [isRetrying, setIsRetrying] = useState(false);
  const { toast } = useToast();

  const parseEdgeErrorBody = (edgeError: unknown): Record<string, unknown> | null => {
    const rawBody = (
      edgeError as { context?: { body?: unknown } } | undefined
    )?.context?.body;
    if (!rawBody) return null;

    try {
      if (typeof rawBody === "string") return JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof rawBody === "object") return rawBody as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  };

  const handleRetryPayment = async () => {
    if (!applicationId) return;
    setIsRetrying(true);

    try {
      const { data: appData, error: appError } = await supabase
        .from("applications")
        .select("id, project_id")
        .eq("id", applicationId)
        .single();

      if (appError || !appData) {
        throw new Error("Application not found");
      }

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            applicationId: appData.id,
            projectId: appData.project_id,
            successUrl: `${window.location.origin}/payment/success?application_id=${appData.id}`,
            cancelUrl: `${window.location.origin}/payment/cancel?application_id=${appData.id}`,
          },
        },
      );

      if (checkoutError) {
        const checkoutErrorBody = parseEdgeErrorBody(checkoutError);
        const msg = (checkoutErrorBody?.error as string | undefined) ||
          checkoutError.message ||
          "Failed to create checkout session";
        throw new Error(msg);
      }

      if (!checkoutData?.url) {
        throw new Error("Checkout session response missing URL");
      }

      window.location.assign(checkoutData.url);
    } catch (error) {
      toast({
        title: "Payment Setup Failed",
        description: error instanceof Error ? error.message : "Could not start payment checkout.",
        variant: "destructive",
      });
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <CardDescription>
              Your payment was not completed. Your application has been saved and is awaiting payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You can complete the payment from your application details page at any time.
            </p>
            <div className="flex flex-col gap-2">
              {applicationId && (
                <Button onClick={handleRetryPayment} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    "Retry Payment"
                  )}
                </Button>
              )}
              {applicationId && (
                <Button onClick={() => navigate(`/dashboard/applications/${applicationId}`)}>
                  View Application
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/dashboard/applications")}>
                Go to Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const PaymentCancel = () => (
  <ProtectedRoute>
    <PaymentCancelContent />
  </ProtectedRoute>
);

export default PaymentCancel;
