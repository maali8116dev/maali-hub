import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";

export const initPostHog = () => {
  if (!POSTHOG_KEY) {
    console.warn("PostHog API key not configured. Analytics disabled.");
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
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        // Disable in development unless explicitly enabled
        if (!POSTHOG_KEY) {
          posthog.opt_out_capturing();
        }
      }
    },
  });
};

// Identify user for tracking
export const identifyUser = (user: { 
  id: string; 
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}) => {
  if (!POSTHOG_KEY) return;
  
  posthog.identify(user.id, {
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });
};

// Reset user on logout
export const resetUser = () => {
  if (!POSTHOG_KEY) return;
  posthog.reset();
};

// Track custom event
export const trackEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => {
  if (!POSTHOG_KEY) return;
  posthog.capture(eventName, properties);
};

// Track page view manually (if needed)
export const trackPageView = (path?: string) => {
  if (!POSTHOG_KEY) return;
  posthog.capture("$pageview", {
    $current_url: path || window.location.href,
  });
};

// Feature flags
export const isFeatureEnabled = (flagKey: string): boolean => {
  if (!POSTHOG_KEY) return false;
  return posthog.isFeatureEnabled(flagKey) ?? false;
};

// Get feature flag value
export const getFeatureFlag = (flagKey: string): string | boolean | undefined => {
  if (!POSTHOG_KEY) return undefined;
  return posthog.getFeatureFlag(flagKey);
};

export { posthog };
