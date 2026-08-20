// src/config/activityLogging.ts

import type { ActionType, EntityType } from "@/hooks/useActivityLogger";

/**
 * Configuration for selective activity logging to database
 * 
 * Only actions/entities listed here will be logged to the database.
 * All events are still tracked in PostHog for analytics.
 * 
 * Rationale:
 * - 'view' and 'login' are too frequent and not critical for audit trails
 * - 'logout' is less critical than login
 * - Important business events (create, update, delete, submit, approve, reject) are logged
 */
export const ACTIVITY_LOG_CONFIG = {
  // Actions to log to database (important business events)
  logActions: [
    'create',
    'update', 
    'delete',
    'submit',
    'approve',
    'reject',
    'review',
    'select_winners',
    'assign_reviewers',
    // 'logout' - optional, uncomment if you want logout logs
  ] as readonly ActionType[],

  // Actions to skip (too frequent, tracked in PostHog only)
  skipActions: [
    'view',
    'login',
    // 'logout', - uncomment if you don't want logout logs
  ] as readonly ActionType[],

  // All entity types are logged (no filtering by entity)
  // If you want to filter, add: logEntities: ['project', 'application'] as const
} as const;

/**
 * Check if an activity should be logged to the database
 */
export function shouldLogToDatabase(
  actionType: ActionType,
  entityType?: EntityType
): boolean {
  // If action is in skip list, don't log
  if (ACTIVITY_LOG_CONFIG.skipActions.includes(actionType)) {
    return false;
  }

  // If action is in log list, log it
  if (ACTIVITY_LOG_CONFIG.logActions.includes(actionType)) {
    return true;
  }

  // Default: don't log unknown actions
  return false;
}









