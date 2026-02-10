/**
 * Utils module exports
 */

export {
  isString,
  isNumber,
  isBoolean,
  isRecord,
  isArray,
  isNonEmptyString,
  getStringProp,
  getNumberProp,
  getBooleanProp
} from './guards';

export { debounce, CONTEXT_SAVE_DEBOUNCE_MS } from './debounce';

// Error handling (PLAN.md Section 2.10)
export {
  SetuError,
  ErrorCodes,
  type ErrorCode,
  createSetuError,
  wrapHook,
  wrapSync,
  tryAsync,
  trySync,
  sanitizeInput,
  sanitizeArgs,
  type TryResult,
  getErrorMessage,
  getErrorStack,
  isValidationError,
  isFileSystemError
} from './error-handling';

// Git utilities (PLAN.md Section 2.6)
export {
  getCurrentBranch,
  isProtectedBranch
} from './git';

export { PROTECTED_BRANCHES } from '../constants';

export {
  formatGuidanceMessage
} from './messaging';
