import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

let isInitialized = false;

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn("PostHog API key not configured. Analytics disabled.");
    return;
  }

  // Check if user has consented to analytics
  const consent = localStorage.getItem("cookie-consent");
  const preferences = localStorage.getItem("cookie-preferences");
  
  if (consent !== "accepted") {
    console.log("PostHog: Waiting for cookie consent");
    return;
  }

  if (preferences) {
    const prefs = JSON.parse(preferences);
    if (!prefs.analytics) {
      console.log("PostHog: Analytics cookies not accepted");
      return;
    }
  }

  if (isInitialized) {
    return;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      
      // Capture page views automatically
      capture_pageview: true,
      capture_pageleave: true,
      
      // Session recording settings
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".sensitive-data",
      },
      
      // Privacy settings
      respect_dnt: true,
      
      // Handle initialization
      loaded: (posthog) => {
        console.log("PostHog initialized with consent");
      },
      
      // Disable features that might cause CORS issues
      autocapture: false,
      
      // Disable decide endpoint to prevent CORS errors with config.js loading
      // This endpoint tries to load configuration from PostHog CDN which can fail
      advanced_disable_decide: true,
    });

    isInitialized = true;
  } catch (error) {
    console.warn("PostHog initialization failed:", error);
    // Don't break the app if PostHog fails to initialize
    isInitialized = false;
  }
};

// Disable tracking
export const disablePostHog = () => {
  if (isInitialized) {
    posthog.opt_out_capturing();
  }
};

// Identify user for tracking
export const identifyUser = (user: { 
  id: string; 
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}) => {
  if (!isInitialized) return;
  
  try {
    posthog.identify(user.id, {
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    // Silently fail if PostHog is unavailable
    console.debug("PostHog identify failed:", error);
  }
};

// Reset user on logout
export const resetUser = () => {
  if (!isInitialized) return;
  posthog.reset();
};

// Track custom event
export const trackEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => {
  if (!isInitialized) return;
  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    // Silently fail if PostHog is unavailable
    console.debug("PostHog tracking failed:", error);
  }
};

// Track page view manually (if needed)
export const trackPageView = (path?: string) => {
  if (!isInitialized) return;
  posthog.capture("$pageview", {
    $current_url: path || window.location.href,
  });
};

// Feature flags
export const isFeatureEnabled = (flagKey: string): boolean => {
  if (!isInitialized) return false;
  return posthog.isFeatureEnabled(flagKey) ?? false;
};

// Get feature flag value
export const getFeatureFlag = (flagKey: string): string | boolean | undefined => {
  if (!isInitialized) return undefined;
  return posthog.getFeatureFlag(flagKey);
};

export { posthog };
