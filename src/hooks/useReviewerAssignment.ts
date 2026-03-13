/**
 * Main export file for reviewer assignment hooks
 * Re-exports all hooks from focused modules for backward compatibility
 */

// Re-export types
export type {
  ReviewerCategory,
  ApplicationAssignment,
  ReviewerConflict,
  ReviewScore,
  SystemRubric,
  ReviewAggregation,
  DecisionEngineConfig,
  DecisionEngineResult,
} from '@/types/reviewer';

// Re-export assignment hooks
export {
  useAssignReviewers,
  useApplicationAssignments,
  useReviewerAssignments,
  useReviewerWorkload,
  useReviewersectors,
  useUpdateAssignmentStatus,
  useAddConflict,
} from './useReviewerAssignments';

// Re-export rubric hooks
export {
  useSystemRubric,
  useRubricVersions,
} from './useSystemRubric';

// Re-export review score hooks
export {
  useSubmitReview,
  useApplicationReviewScores,
} from './useReviewScores';

// Re-export aggregation hooks
export {
  useReviewAggregation,
  useDecisionEngine,
  calculateDecision,
} from './useReviewAggregation';








