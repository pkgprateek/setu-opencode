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

// Error handling (graceful degradation layer)
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

// Git utilities
export {
  getCurrentBranch,
  isProtectedBranch
} from './git';

export { PROTECTED_BRANCHES } from '../constants';

export {
  formatGuidanceMessage
} from './messaging';
