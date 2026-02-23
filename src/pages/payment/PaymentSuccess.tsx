import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useApplicationFormStore } from "@/stores/applicationForm";

const PaymentSuccessContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { reset } = useApplicationFormStore();
  const applicationId = searchParams.get("application_id");

  useEffect(() => {
    // Clear form store after successful payment + submission
    reset();
  }, [reset]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription>
              Your application fee has been paid and your application has been submitted for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You will receive an email confirmation shortly. Our team will review your application and notify you of the outcome.
            </p>
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
