import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Loader2 } from "lucide-react";

export default function TestPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const projectId = Number(searchParams.get("projectId") || searchParams.get("project_id")) || 5;
  type SubmitPayload = {
    success?: boolean;
    error?: string;
    errorCode?: string;
    existingApplicationId?: string;
    requiresPayment?: boolean;
    checkoutUrl?: string;
  };

  const parseEdgeErrorBody = (edgeError: unknown): Record<string, unknown> | null => {
    const rawBody = (edgeError as { context?: { body?: unknown } } | undefined)?.context?.body;
    if (!rawBody) return null;

    try {
      if (typeof rawBody === "string") return JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof rawBody === "object") return rawBody as Record<string, unknown>;
    } catch {
      return null;
    }

    return null;
  };

  const handleTestPayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to continue.",
        variant: "destructive",
      });
      return;
    }

    // Verify session is active
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      toast({
        title: "Session Expired",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Ensure project exists and has a fee
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, title, application_fee")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        console.error(`Project not found for ID ${projectId}`, projectError);
        throw new Error("The selected project could not be found. Please check the project ID and try again.");
      }

      const feeValue = project.application_fee ? String(project.application_fee) : "0";
      const projectFee = parseFloat(feeValue);
      if (!projectFee || projectFee <= 0) {
        await supabase
          .from("projects")
          .update({ application_fee: 50 })
          .eq("id", projectId);
      }

      // Use the same edge function as the application form submit flow
      const applicationData = {
        applicant_type: "Individual",
        full_legal_name: "Test User",
        organization_name: null,
        registration_id_number: null,
        country_of_residence: "US",
        city_region: "Test City",
        contact_email: user.email || "test@example.com",
        contact_phone: "+1234567890",
        project_title: project.title || "Test Project",
        project_summary: "Test payment application",
        geographic_focus: "Test Location",
        linkedin_url: null,
        github_url: null,
        twitter_url: null,
        website_url: null,
        other_social_links: null,
        information_accurate_confirmed: true,
        conflict_of_interest_declared: false,
        reporting_requirements_agreed: true,
        data_processing_consented: true,
      };

      // Explicitly ensure we have a valid session before calling the edge function
      const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
      if (sessionCheckError || !session || !session.access_token) {
        throw new Error("Your session has expired. Please sign in again to continue.");
      }

      console.log("Session check passed, calling submit-application...");

      let submitData: unknown = null;
      let submitError: unknown = null;

      // Try calling the edge function with explicit Authorization header
      const result = await supabase.functions.invoke("submit-application", {
        body: {
          projectId,
          applicationData,
          libraryDocumentIds: [],
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      submitData = result.data;
      submitError = result.error;

      // If 401, try refreshing session and retry once
      if (submitError && (submitError as { status?: number }).status === 401) {
        console.log("Got 401, refreshing session and retrying...");
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error("Your session has expired. Please sign in again to continue.");
        }
        
        // Retry after refresh - get fresh session
        const { data: { session: refreshedSession } } = await supabase.auth.getSession();
        if (!refreshedSession?.access_token) {
          throw new Error("Your session has expired. Please sign in again to continue.");
        }
        
        const retryResult = await supabase.functions.invoke("submit-application", {
          body: {
            projectId,
            applicationData,
            libraryDocumentIds: [],
          },
          headers: {
            Authorization: `Bearer ${refreshedSession.access_token}`,
          },
        });
        
        submitData = retryResult.data;
        submitError = retryResult.error;
      }

      const submitErrorBody = submitError ? parseEdgeErrorBody(submitError) : null;
      const submitPayload: SubmitPayload | null = (!submitData || typeof submitData !== "object")
        ? (submitErrorBody as SubmitPayload | null)
        : (submitData as SubmitPayload);

      if (submitPayload?.errorCode === "ALREADY_APPLIED") {
        let existingApplicationId = submitPayload.existingApplicationId;
        if (!existingApplicationId) {
          const { data: existingApp, error: existingAppError } = await supabase
            .from("applications")
            .select("id")
            .eq("user_id", user.id)
            .eq("project_id", projectId)
            .maybeSingle();

      if (existingAppError) {
        console.error("Failed to fetch existing application:", existingAppError);
        throw new Error("We couldn't look up your existing application. Please try again.");
      }
          existingApplicationId = existingApp?.id;
        }

        if (existingApplicationId) {
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
            "create-checkout-session",
            {
              body: {
                applicationId: existingApplicationId,
                projectId,
                successUrl: `${window.location.origin}/payment/success?application_id=${existingApplicationId}`,
                cancelUrl: `${window.location.origin}/payment/cancel?application_id=${existingApplicationId}`,
              },
            }
          );

          if (checkoutError) {
            console.error("Checkout error:", checkoutError);
            const checkoutErrorBody = parseEdgeErrorBody(checkoutError);
            const rawMsg = (checkoutErrorBody?.error as string | undefined) || checkoutError.message;
            console.error("Checkout error detail:", rawMsg);

            // Map specific server errors to friendly messages
            if (rawMsg?.includes("fee already paid")) {
              throw new Error("This application fee has already been paid.");
            }
            throw new Error("We couldn't set up the payment page. Please try again.");
          }

          if (checkoutData?.url) {
            window.location.assign(checkoutData.url);
            return;
          }

          throw new Error("We couldn't set up the payment page. Please try again.");
        }
      }

      if (submitError) {
        console.error("Submit error:", submitError);
        const rawMsg = (submitPayload?.error as string | undefined) || 
          ((submitError as { message?: string }).message);
        console.error("Submit error detail:", rawMsg);

        // Map error codes to friendly messages
        const errorCode = submitPayload?.errorCode;
        if (errorCode === "UNAUTHORIZED") {
          throw new Error("Your session has expired. Please sign in again to continue.");
        }
        if (errorCode === "CHECKOUT_ERROR") {
          throw new Error("We couldn't set up the payment. Please try again.");
        }
        throw new Error("Something went wrong submitting the application. Please try again.");
      }

      if (!submitPayload?.success) {
        const rawMsg = (submitPayload?.error as string | undefined);
        console.error("Submit failed:", rawMsg);
        throw new Error("Something went wrong submitting the application. Please try again.");
      }

      if (submitPayload.requiresPayment && submitPayload.checkoutUrl) {
        window.location.assign(submitPayload.checkoutUrl);
        return;
      }

      throw new Error("Application submitted but no payment was required. The project fee may be $0.");
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Setup Failed",
        description: error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Test Payment
          </CardTitle>
          <CardDescription>
            Create a test application and open Stripe Checkout (dev only)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="button" disabled={isLoading} onClick={handleTestPayment} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Open Stripe Payment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

