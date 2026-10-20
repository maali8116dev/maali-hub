import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

let isInitialized = false;

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  // Check if user has consented to analytics
  const consent = localStorage.getItem("cookie-consent");
  const preferences = localStorage.getItem("cookie-preferences");
  
  if (consent !== "accepted") {
    console.log("Sentry: Waiting for cookie consent");
    return;
  }

  if (preferences) {
    const prefs = JSON.parse(preferences);
    if (!prefs.analytics) {
      console.log("Sentry: Analytics cookies not accepted");
      return;
    }
  }

  if (isInitialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    
    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Session replay (optional)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Enable when DSN is configured
    enabled: true,
    
    // Filter out known benign errors
    beforeSend(event, hint) {
      const error = hint?.originalException;
      
      // Ignore network errors that are expected
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          return null;
        }
        if (error.message.includes("NetworkError")) {
          return null;
        }
        // Ignore ResizeObserver errors (browser quirk)
        if (error.message.includes("ResizeObserver")) {
          return null;
        }
      }
      
      return event;
    },
    
    // Add context to errors
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });

  isInitialized = true;
  console.log("Sentry initialized with consent");
};

// Re-initialize after consent is given
export const initSentryWithConsent = () => {
  initSentry();
};

// Set user context when authenticated
export const setSentryUser = (user: { id: string; email?: string }) => {
  if (!isInitialized) return;
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
};

// Clear user context on logout
export const clearSentryUser = () => {
  if (!isInitialized) return;
  Sentry.setUser(null);
};

// Capture exception with additional context
export const captureError = (
  error: Error,
  context?: Record<string, unknown>
) => {
  if (!isInitialized) {
    console.error("Sentry not initialized, error not captured:", error);
    return;
  }
  Sentry.captureException(error, {
    extra: context,
  });
};

// Add breadcrumb for better error context
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
) => {
  if (!isInitialized) return;
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
};

export { Sentry };








