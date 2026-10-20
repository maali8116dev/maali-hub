import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Clock, Mail } from "lucide-react";

interface MaintenanceModeProps {
  message?: string;
  estimatedTime?: string;
  contactEmail?: string;
}

/**
 * Maintenance mode screen displayed when the application is under maintenance
 */
export function MaintenanceMode({
  message = "We're currently performing scheduled maintenance to improve your experience.",
  estimatedTime,
  contactEmail,
}: MaintenanceModeProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Wrench className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-3xl">Under Maintenance</CardTitle>
          <CardDescription className="text-lg">{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {estimatedTime && (
            <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Estimated completion: <strong>{estimatedTime}</strong>
              </span>
            </div>
          )}

          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              We apologize for any inconvenience. Please check back soon.
            </p>
            {contactEmail && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-sm text-primary hover:underline"
                >
                  {contactEmail}
                </a>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Thank you for your patience while we work to improve our services.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}









