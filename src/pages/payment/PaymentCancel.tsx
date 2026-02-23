import { useSearchParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";

const PaymentCancelContent = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const applicationId = searchParams.get("application_id");

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
