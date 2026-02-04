import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { trackEvent } from "@/lib/posthog";
import { shouldLogToDatabase } from "@/config/activityLogging";

export type ActionType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'view' 
  | 'login' 
  | 'logout' 
  | 'submit' 
  | 'approve' 
  | 'reject';

export type EntityType = 
  | 'project' 
  | 'application' 
  | 'user' 
  | 'blog_post' 
  | 'profile' 
  | 'document';

interface LogActivityParams {
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface ActivityLogInsert {
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
}

export function useActivityLogger() {
  const { user } = useAuth();

  const logActivity = async ({
    actionType,
    entityType,
    entityId,
    description,
    metadata,
  }: LogActivityParams) => {
    try {
      // Always send to PostHog for analytics (regardless of DB logging)
      trackEvent(`${entityType}_${actionType}`, {
        entity_type: entityType,
        entity_id: entityId,
        action_type: actionType,
        description,
        ...metadata,
      });

      // Only log to database if configured to do so
      if (!shouldLogToDatabase(actionType, entityType)) {
        return; // Skip database logging, but PostHog already tracked it
      }

      const insertData: ActivityLogInsert = {
        user_id: user?.id || null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId || null,
        description,
        metadata: metadata || null,
        user_agent: navigator.userAgent,
      };

      const { error } = await supabase
        .from('activity_logs' as any)
        .insert(insertData as any);

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (err) {
      console.error('Activity logging error:', err);
    }
  };

  return { logActivity };
}

// Standalone function for cases where hook context isn't available
export async function logActivityDirect({
  userId,
  actionType,
  entityType,
  entityId,
  description,
  metadata,
}: LogActivityParams & { userId?: string }) {
  try {
    // Always send to PostHog for analytics (regardless of DB logging)
    trackEvent(`${entityType}_${actionType}`, {
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      user_id: userId,
      description,
      ...metadata,
    });

    // Only log to database if configured to do so
    if (!shouldLogToDatabase(actionType, entityType)) {
      return; // Skip database logging, but PostHog already tracked it
    }

    const insertData: ActivityLogInsert = {
      user_id: userId || null,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId || null,
      description,
      metadata: metadata || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    };

    const { error } = await supabase
      .from('activity_logs' as any)
      .insert(insertData as any);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (err) {
    console.error('Activity logging error:', err);
  }
}
