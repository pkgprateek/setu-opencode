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
  ObservedPattern
} from './types';

export {
  createEmptyContext,
  contextToSummary,
  formatContextForInjection
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

// Feedback
export type { FeedbackEntry } from './feedback';

export {
  initializeFeedbackFile,
  appendFeedback,
  getFeedbackPath,
  hasFeedbackFile
} from './feedback';

// Project rules (Silent Exploration)
export type { ProjectRules, ActiveTask } from './project-rules';

export {
  loadProjectRules,
  formatRulesForInjection,
  hasProjectRules
} from './project-rules';
