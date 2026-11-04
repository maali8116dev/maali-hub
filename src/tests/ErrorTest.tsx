import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { captureError } from "@/lib/sentry";
import { AlertTriangle, Bug, Zap } from "lucide-react";

export const ErrorTest = () => {
  // Test 1: Throw an unhandled error (caught by ErrorBoundary)
  const triggerUnhandledError = () => {
    throw new Error("Test unhandled error - This should appear in Sentry!");
  };

  // Test 2: Manually capture an error
  const triggerCapturedError = () => {
    try {
      throw new Error("Test captured error - Manually sent to Sentry");
    } catch (error) {
      captureError(error as Error, {
        testType: "manual_capture",
        timestamp: new Date().toISOString(),
        page: "/tests/error",
      });
      alert("Error captured and sent to Sentry! Check your Sentry dashboard.");
    }
  };

  // Test 3: Async error
  const triggerAsyncError = async () => {
    try {
      await new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Test async error - Promise rejection")), 100);
      });
    } catch (error) {
      captureError(error as Error, {
        testType: "async_error",
        timestamp: new Date().toISOString(),
      });
      alert("Async error captured and sent to Sentry!");
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-6 w-6 text-destructive" />
            Sentry Error Testing
          </CardTitle>
          <CardDescription>
            Use these buttons to test your Sentry integration. Errors will be sent to your Sentry dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warning
            </h3>
            <p className="text-sm text-muted-foreground">
              The "Unhandled Error" button will crash the component and show the error boundary. 
              Use the other buttons for non-breaking tests.
            </p>
          </div>

          <div className="grid gap-3">
            <Button 
              variant="destructive" 
              onClick={triggerUnhandledError}
              className="w-full"
            >
              <Zap className="mr-2 h-4 w-4" />
              Trigger Unhandled Error (Crashes UI)
            </Button>

            <Button 
              variant="outline" 
              onClick={triggerCapturedError}
              className="w-full"
            >
              <Bug className="mr-2 h-4 w-4" />
              Trigger Captured Error (Safe)
            </Button>

            <Button 
              variant="outline" 
              onClick={triggerAsyncError}
              className="w-full"
            >
              <Zap className="mr-2 h-4 w-4" />
              Trigger Async Error (Safe)
            </Button>
          </div>

          <div className="mt-6 p-4 border rounded-lg">
            <h4 className="font-medium mb-2">How to verify:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click one of the buttons above</li>
              <li>Go to <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">sentry.io</a></li>
              <li>Navigate to your project's Issues page</li>
              <li>You should see the test error appear</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorTest;








