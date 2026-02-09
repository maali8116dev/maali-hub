import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PaymentStepProps {
  projectId: number;
  applicationId?: string; // Kept for future use when payment is fully implemented
  onPaymentSuccess: () => void;
}

export function PaymentStep({ projectId, onPaymentSuccess }: PaymentStepProps) {
  const hasCalledSuccess = useRef(false);
  
  // Payment is not fully implemented yet - auto-complete to allow form submission
  useEffect(() => {
    // Automatically mark payment as completed since Stripe is not fully implemented
    // Only call once on mount to prevent infinite loops
    if (!hasCalledSuccess.current) {
      hasCalledSuccess.current = true;
      onPaymentSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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

  // Payment feature is not fully implemented yet - show info message and allow proceeding
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

  // Payment feature not fully implemented - show coming soon message
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <p className="font-semibold mb-1">Payment Processing Coming Soon</p>
        <p>
          Payment processing is currently being set up. You can proceed to review and submit your application without payment at this time.
          {project.application_fee > 0 && (
            <span className="block mt-1 text-sm">
              Note: This project has an application fee of ${(project.application_fee / 100).toFixed(2)}, but payment will be handled separately.
            </span>
          )}
        </p>
      </AlertDescription>
    </Alert>
  );
}

