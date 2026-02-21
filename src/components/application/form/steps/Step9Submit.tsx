export function Step9Submit() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          Submit Your Application
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Review the confirmation notice below and click the submit button to
          finalize your application.
        </p>
      </div>

      {/* Confirmation Notice */}
      <div className="bg-muted/50 border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          By submitting this application, you confirm that all the information
          provided is accurate and complete. Your application will be reviewed
          by our team and you will be notified of the outcome via email.
        </p>
      </div>
    </div>
  );
}

