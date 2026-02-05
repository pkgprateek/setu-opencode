/**
 * Shared path validation utilities
 * 
 * Centralizes path validation logic to prevent code duplication
 * and ensure consistent security checks across the codebase.
 */

import { normalize, resolve } from 'path';

/**
 * Error thrown when path validation fails
 */
export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
    
    // Restore prototype chain for proper instanceof checks after transpilation
    Object.setPrototypeOf(this, PathValidationError.prototype);
  }
}

/**
 * Validate project directory path to prevent directory traversal
 * Ensures the resolved path does not contain traversal patterns
 * 
 * @param projectDir - The directory path to validate
 * @throws PathValidationError if validation fails
 */
export function validateProjectDir(projectDir: string): void {
  // Validate input at API boundary
  if (typeof projectDir !== 'string' || projectDir.length === 0) {
    throw new PathValidationError('projectDir must be a non-empty string');
  }

  // Prevent null bytes and control characters (including DEL 0x7f)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char detection for security
  if (/[\x00-\x1f\x7f]/.test(projectDir)) {
    throw new PathValidationError('Invalid characters in project directory path');
  }

  // SECURITY: Check for path traversal attempts BEFORE normalization
  // This catches attempts like "../../../etc/passwd" before resolve() normalizes them
  if (projectDir.includes('..')) {
    throw new PathValidationError('Invalid projectDir: path traversal detected');
  }

  const resolved = normalize(resolve(projectDir));

  // Additional check: ensure resolved path doesn't contain '..' (shouldn't happen after resolve, but defense in depth)
  if (resolved.includes('..')) {
    throw new PathValidationError('Invalid projectDir: path traversal detected after resolution');
  }
}

/**
 * Validate and resolve project directory path
 * Combines validation with path resolution for convenience
 * 
 * @param projectDir - The directory path to validate and resolve
 * @returns The resolved, normalized path
 * @throws PathValidationError if validation fails
 */
export function validateAndResolveProjectDir(projectDir: string): string {
  validateProjectDir(projectDir);
  return normalize(resolve(projectDir));
}

/**
 * Type guard to check if error is a PathValidationError
 */
export function isPathValidationError(error: unknown): error is PathValidationError {
  return error instanceof PathValidationError;
}
