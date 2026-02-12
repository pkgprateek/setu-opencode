/**
 * Context module exports
 * 
 * Provides context collection, persistence, and injection for Setu.
 */

// Types
export type {
  SetuContext,
  SetuContextSummary,
  ProjectInfo,
  FileRead,
  SearchPerformed,
  ObservedPattern,
  // Active Task types
  ConstraintType,
  TaskStatus,
  ActiveTask
} from './types';

export {
  createEmptyContext,
  contextToSummary,
  formatContextForInjection,
  // Constraint types
  CONSTRAINT_TYPES
} from './types';

// Storage
export type { ContextCollector } from './storage';

export {
  loadContext,
  saveContext,
  createContextCollector,
  logVerification,
  detectProjectInfo,
  ensureSetuDir
} from './storage';

// Active Task (Movement 3)
export {
  loadActiveTask,
  saveActiveTask,
  createActiveTask,
  updateTaskStatus,
  clearActiveTask,
  shouldBlockDueToConstraint,
  resetProgress,
  advanceStep,
  recordFailedApproach,
  recordWorkedApproach
} from './active';

// Token Status (Movement 3)
export type { TokenStatus, TokenSeverity } from './token';

export {
  getTokenStatus,
  getTokenSeverity,
  getTokenWarningMessage,
  TOKEN_THRESHOLDS
} from './token';

// Feedback
export type { FeedbackEntry } from './feedback';

export {
  initializeFeedbackFile,
  appendFeedback,
  getFeedbackPath,
  hasFeedbackFile,
  // Session rate limiting
  incrementFeedbackCount,
  clearSessionFeedback
} from './feedback';

export type { RateLimitResult } from './feedback';

// Results Pattern (Phase 3.0)
export type { StepResult } from './results';

export {
  writeStepResult,
  readStepResult,
  listCompletedSteps,
  clearResults,
  getLastCompletedStep,
} from './results';

// Re-export from unified sanitization module
export { sanitizeYamlString } from '../utils/sanitization';

// Cleanse Protocol (Phase 3.0)
export type { CleanseOptions, JITContext } from './cleanse';

export { prepareJITContext, getJITContextSummary } from './cleanse';

// Project rules (Silent Exploration)
export type { ProjectRules, GitState } from './project-rules';

export {
  loadProjectRules,
  formatRulesForInjection,
  hasProjectRules
} from './project-rules';

// Discipline guards (safety, question blocking, overwrite protection)
export type {
  SetuDisciplineState,
  OverwriteRequirementState,
  PendingSafetyConfirmation,
} from './setu-state';

export {
  getDisciplineState,
  setDisciplineState,
  setQuestionBlocked,
  clearQuestionBlocked,
  setSafetyBlocked,
  clearSafetyBlocked,
  setPendingSafetyConfirmation,
  getPendingSafetyConfirmation,
  approvePendingSafetyConfirmation,
  denyPendingSafetyConfirmation,
  clearPendingSafetyConfirmation,
  clearDisciplineState,
  setOverwriteRequirement,
  getOverwriteRequirement,
  clearOverwriteRequirement,
} from './setu-state';
