import { useState } from "react";
import { AlertTriangle, X, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationBannerProps {
  email: string;
  onDismiss?: () => void;
}

const EmailVerificationBanner = ({ email, onDismiss }: EmailVerificationBannerProps) => {
  const [isResending, setIsResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({
          title: "Failed to resend",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification email sent",
          description: "Please check your inbox and spam folder.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Verify your email address
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            We sent a verification link to <span className="font-medium">{email}</span>. 
            Please check your inbox and spam folder to verify your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              disabled={isResending}
              className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              {isResending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-1" />
                  Resend verification email
                </>
              )}
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;








