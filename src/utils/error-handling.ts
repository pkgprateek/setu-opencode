/**
 * Error Handling Layer for Setu
 * 
 * Provides graceful degradation — Setu failures should never break OpenCode.
 */

import { errorLog, debugLog } from '../debug';

/**
 * Error codes for common Setu errors
 */
export const ErrorCodes = {
  // Context errors
  CONTEXT_LOAD_FAILED: 'CONTEXT_LOAD_FAILED',
  CONTEXT_SAVE_FAILED: 'CONTEXT_SAVE_FAILED',
  CONTEXT_CORRUPTED: 'CONTEXT_CORRUPTED',
  
  // Enforcement errors
  GEAR_DETERMINATION_FAILED: 'GEAR_DETERMINATION_FAILED',
  CONSTRAINT_PARSE_FAILED: 'CONSTRAINT_PARSE_FAILED',
  
  // Tool errors
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  
  // Config errors
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  
  // Security errors
  PATH_TRAVERSAL_BLOCKED: 'PATH_TRAVERSAL_BLOCKED',
  SECRETS_DETECTED: 'SECRETS_DETECTED',
  UNKNOWN_TOOL_BLOCKED: 'UNKNOWN_TOOL_BLOCKED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Setu-specific error with recovery information
 */
export class SetuError extends Error {
  constructor(
    message: string,
    /** Error code for programmatic handling */
    public readonly code: ErrorCode,
    /** Whether the operation can be retried */
    public readonly recoverable: boolean = true,
    /** Suggested user action */
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = 'SetuError';
    
    // Restore prototype chain for proper instanceof checks after transpilation
    Object.setPrototypeOf(this, SetuError.prototype);
    
    // Capture stack trace for better debugging (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SetuError);
    }
  }
}

/**
 * Create a SetuError with a standard format
 */
export function createSetuError(
  code: ErrorCode,
  message: string,
  options: { recoverable?: boolean; suggestion?: string } = {}
): SetuError {
  return new SetuError(
    message,
    code,
    options.recoverable ?? true,
    options.suggestion
  );
}

/**
 * Wrap an async function (typically a hook) to handle errors gracefully.
 * 
 * Known SetuErrors are re-thrown with context.
 * Unknown errors are logged and the function returns undefined (graceful degradation).
 * 
 * This prevents Setu from breaking OpenCode when errors occur.
 * 
 * @param hookName - Name of the hook for logging
 * @param fn - The async function to wrap
 * @returns Wrapped function that handles errors gracefully (may return undefined on error)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- preserves generic hook signatures so typed hook parameters can be wrapped
export function wrapHook<T extends (...args: any[]) => Promise<any>>(
  hookName: string,
  fn: T
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | undefined> {
  return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof SetuError) {
        // Known error - re-throw with context for proper handling
        throw error;
      }
      
      // Unknown error - log and gracefully degrade
      errorLog(`Hook ${hookName} failed:`, error);
      if (process.env.SETU_DEBUG === 'true') {
        debugLog(`Hook ${hookName} failed (debug):`, error);
      }
      
      // Don't block the operation - just log
      // This prevents Setu from breaking OpenCode
      return undefined;
    }
  };
}

/**
 * Wrap a sync function to handle errors gracefully.
 * 
 * @param functionName - Name of the function for logging
 * @param fn - The sync function to wrap
 * @param fallback - Value to return on error
 * @returns Wrapped function that handles errors gracefully
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- preserves generic function signatures for sync wrapper
export function wrapSync<T extends (...args: any[]) => any, R>(
  functionName: string,
  fn: T,
  fallback: R
): (...args: Parameters<T>) => ReturnType<T> | R {
  return (...args: Parameters<T>) => {
    try {
      return fn(...args) as ReturnType<T>;
    } catch (error) {
      errorLog(`Function ${functionName} failed:`, error);
      return fallback;
    }
  };
}

/**
 * Try an operation, returning a result object instead of throwing
 */
export type TryResult<T> = 
  | { ok: true; value: T }
  | { ok: false; error: SetuError | Error };

/**
 * Execute an async operation and return a result object.
 * Never throws - errors are captured in the result.
 */
export async function tryAsync<T>(
  operation: () => Promise<T>,
  context: string
): Promise<TryResult<T>> {
  try {
    const value = await operation();
    return { ok: true, value };
  } catch (error) {
    debugLog(`Try failed (${context}):`, error);
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Execute a sync operation and return a result object.
 * Never throws - errors are captured in the result.
 */
export function trySync<T>(
  operation: () => T,
  context: string
): TryResult<T> {
  try {
    const value = operation();
    return { ok: true, value };
  } catch (error) {
    debugLog(`Try failed (${context}):`, error);
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Get error message from unknown error type
 * Standardizes error message extraction across the codebase
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Get error stack trace if available
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  // Check error name (common validation error types)
  if (error.name === 'ValidationError' || 
      error.name === 'ZodError' ||
      error.name === 'ValidatorError') {
    return true;
  }
  
  // Case-insensitive, specific message checks
  const msg = error.message.toLowerCase();
  return msg.includes('validation failed') ||
    msg.includes('invalid input') ||
    msg.includes('validation error') ||
    msg.includes('failed validation');
}

/**
 * Check if error is a filesystem error
 */
export function isFileSystemError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return ['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'EEXIST', 'ENOTDIR', 'EROFS', 'ENOSPC'].includes(code || '');
}

/**
 * Input sanitization: Remove null bytes and control characters
 * Prevents log injection and control-char bypass attacks.
 */
export function sanitizeInput(value: unknown): unknown {
  if (typeof value === 'string') {
    // Remove null bytes and control characters (except newline, tab)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control chars for sanitization
    const nullBytePattern = /\u0000/g;
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control chars for sanitization
    const controlCharPattern = /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g;
    return value
      .replace(nullBytePattern, '')
      .replace(controlCharPattern, '');
  }
  
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const sanitizedKey = sanitizeInput(key) as string;
      // Warn on key collision (theoretical but worth logging for debugging)
      if (Object.hasOwn(sanitized, sanitizedKey)) {
        debugLog(`sanitizeInput: Key collision detected - "${key}" sanitized to existing key "${sanitizedKey}"`);
      }
      sanitized[sanitizedKey] = sanitizeInput(val);
    }
    return sanitized;
  }
  
  return value;
}

/**
 * Sanitize tool arguments before execution
 */
export function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  return sanitizeInput(args) as Record<string, unknown>;
}
