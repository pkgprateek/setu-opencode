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
  shouldBlockDueToConstraint
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
  hasFeedbackFile
} from './feedback';

// Project rules (Silent Exploration)
export type { ProjectRules, GitState } from './project-rules';

export {
  loadProjectRules,
  formatRulesForInjection,
  hasProjectRules
} from './project-rules';
