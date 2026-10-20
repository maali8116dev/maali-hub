import { useCallback } from "react";
import { 
  trackEvent as posthogTrack, 
  identifyUser as posthogIdentify, 
  resetUser as posthogReset 
} from "@/lib/posthog";
import { 
  setSentryUser, 
  clearSentryUser, 
  addBreadcrumb 
} from "@/lib/sentry";

interface UserData {
  id: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

// Analytics event types for type safety
export type AnalyticsEvent =
  | "page_view"
  | "user_signed_up"
  | "user_logged_in"
  | "user_logged_out"
  | "project_viewed"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "application_started"
  | "application_step_completed"
  | "application_submitted"
  | "application_abandoned"
  | "document_uploaded"
  | "admin_action"
  | "error_occurred"
  | "search_performed"
  | "filter_applied";

export const useAnalytics = () => {
  // Track a custom event
  const track = useCallback((
    event: AnalyticsEvent | string,
    properties?: Record<string, unknown>
  ) => {
    // Send to PostHog
    posthogTrack(event, properties);
    
    // Add Sentry breadcrumb for context
    addBreadcrumb(event, "analytics", properties);
  }, []);

  // Identify user in both services
  const identify = useCallback((user: UserData) => {
    // PostHog identification
    posthogIdentify(user);
    
    // Sentry user context
    setSentryUser({
      id: user.id,
      email: user.email,
    });
  }, []);

  // Reset user in both services (on logout)
  const reset = useCallback(() => {
    posthogReset();
    clearSentryUser();
  }, []);

  // Application funnel tracking helpers
  const trackApplicationStart = useCallback((opportunityId: number, projectTitle: string) => {
    track("application_started", {
      opportunity_id: opportunityId,
      project_title: projectTitle,
      timestamp: new Date().toISOString(),
    });
  }, [track]);

  const trackApplicationStep = useCallback((
    opportunityId: number,
    stepNumber: number,
    stepName: string
  ) => {
    track("application_step_completed", {
      opportunity_id: opportunityId,
      step_number: stepNumber,
      step_name: stepName,
      timestamp: new Date().toISOString(),
    });
  }, [track]);

  const trackApplicationSubmit = useCallback((
    opportunityId: number,
    applicationId: string
  ) => {
    track("application_submitted", {
      opportunity_id: opportunityId,
      application_id: applicationId,
      timestamp: new Date().toISOString(),
    });
  }, [track]);

  const trackApplicationAbandon = useCallback((
    opportunityId: number,
    lastStep: number
  ) => {
    track("application_abandoned", {
      opportunity_id: opportunityId,
      last_step: lastStep,
      timestamp: new Date().toISOString(),
    });
  }, [track]);

  // Admin action tracking
  const trackAdminAction = useCallback((
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) => {
    track("admin_action", {
      action,
      entity_type: entityType,
      entity_id: entityId,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }, [track]);

  return {
    track,
    identify,
    reset,
    trackApplicationStart,
    trackApplicationStep,
    trackApplicationSubmit,
    trackApplicationAbandon,
    trackAdminAction,
  };
};

export default useAnalytics;








