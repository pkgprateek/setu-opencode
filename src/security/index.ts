/**
 * Security module for Setu
 * 
 * Provides security utilities for:
 * - Path validation (prevent traversal attacks)
 * - Prompt sanitization (prevent injection attacks)
 * - Secrets detection (prevent accidental leaks)
 * - Security audit logging
 * - Debug log redaction
 */

export {
  validateFilePath,
  isPathWithinProject,
  isSensitiveFile,
  SENSITIVE_FILE_PATTERNS,
  type PathValidationResult
} from './path-validation';

export {
  sanitizeForPrompt,
  sanitizeContextInput,
  MAX_CONTEXT_LENGTH
} from './prompt-sanitization';

export {
  detectSecrets,
  containsSecrets,
  SECRET_PATTERNS,
  type SecretMatch
} from './secrets-detection';

export {
  logSecurityEvent,
  SecurityEventType,
  type SecurityEvent
} from './audit-log';

export {
  redactSensitive,
  REDACTION_PATTERNS
} from './redaction';
