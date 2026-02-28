import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useApplicationFormStore } from "@/stores/applicationForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PaymentSuccessContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reset } = useApplicationFormStore();
  const { user } = useAuth();
  const applicationId = searchParams.get("application_id");

  useEffect(() => {
    // Clear form store after successful payment + submission
    reset();
  }, [reset]);

  // Verify the payment actually completed by checking application status
  const { data: application, isLoading } = useQuery({
    queryKey: ["payment-verification", applicationId],
    queryFn: async () => {
      if (!applicationId || !user) return null;
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, application_fee_paid")
        .eq("id", applicationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId && !!user,
    // Poll every 3s for up to ~30s while we wait for the webhook to process
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.application_fee_paid) return false; // stop polling
      return 3000;
    },
  });

  const isVerified = application?.application_fee_paid === true;
  const isPending = isLoading || (applicationId && !isVerified);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center">
          <CardHeader>
            {isPending ? (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-500 animate-spin" />
                </div>
                <CardTitle className="text-2xl">Confirming Payment…</CardTitle>
                <CardDescription>
                  We're verifying your payment with our payment processor. This usually takes a few seconds.
                </CardDescription>
              </>
            ) : isVerified ? (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                </div>
                <CardTitle className="text-2xl">Payment Successful!</CardTitle>
                <CardDescription>
                  Your application fee has been paid and your application has been submitted for review.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
                </div>
                <CardTitle className="text-2xl">Payment Processing</CardTitle>
                <CardDescription>
                  Your payment may still be processing. Please check your application status in a few minutes.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isVerified && (
              <p className="text-sm text-muted-foreground">
                You will receive an email confirmation shortly. Our team will review your application and notify you of the outcome.
              </p>
            )}
            <div className="flex flex-col gap-2">
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

const PaymentSuccess = () => (
  <ProtectedRoute>
    <PaymentSuccessContent />
  </ProtectedRoute>
);

export default PaymentSuccess;
