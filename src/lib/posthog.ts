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
    
    // Performance
    loaded: () => {
      console.log("PostHog initialized with consent");
    },
  });

  isInitialized = true;
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
  
  posthog.identify(user.id, {
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });
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
  posthog.capture(eventName, properties);
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
