/**
 * Prompt sanitization for injection prevention
 *
 * Sanitizes user-provided content before injection into system prompts.
 * Prevents prompt injection attacks where users try to override Setu's instructions.
 *
 * @deprecated This module now re-exports from the unified sanitization pipeline.
 *             Import from '../utils/sanitization' for new code.
 */

// Re-export from unified sanitization pipeline
export {
  MAX_LENGTHS,
  createPromptSanitizer,
  createYamlSanitizer,
  createOutputSanitizer,
  removeControlChars,
  removeSystemPatterns,
  removeInstructionBoundaries,
  escapeCodeBlocks,
  escapeHtmlTags,
  type SanitizationFilter,
} from '../utils/sanitization';

// Import for creating backward-compatible exports
import { MAX_LENGTHS, createPromptSanitizer } from '../utils/sanitization';

// Backward-compatible sanitizeForPrompt - create instance with default max length
const defaultPromptSanitizer = createPromptSanitizer(MAX_LENGTHS.CONTEXT);
export function sanitizeForPrompt(input: string, maxLength?: number): string {
  // Validate input at API boundary
  if (input == null || typeof input !== 'string') {
    throw new TypeError('sanitizeForPrompt: input must be a string');
  }
  // Validate maxLength if provided: must be a positive integer
  if (maxLength !== undefined) {
    if (typeof maxLength !== 'number' || !Number.isInteger(maxLength) || maxLength <= 0) {
      throw new TypeError(`sanitizeForPrompt: maxLength must be a positive integer, got ${maxLength}`);
    }
    if (maxLength > MAX_LENGTHS.CONTEXT) {
      throw new RangeError(`sanitizeForPrompt: maxLength exceeds maximum allowed (${MAX_LENGTHS.CONTEXT}), got ${maxLength}`);
    }
    if (maxLength !== MAX_LENGTHS.CONTEXT) {
      return createPromptSanitizer(maxLength)(input);
    }
  }
  return defaultPromptSanitizer(input);
}

/**
 * Maximum length for context fields to prevent DoS via large payloads
 * @deprecated Use MAX_LENGTHS from '../utils/sanitization'
 */
export const MAX_CONTEXT_LENGTH = 5000;

/**
 * Maximum length for task descriptions
 * @deprecated Use MAX_LENGTHS from '../utils/sanitization'
 */
export const MAX_TASK_LENGTH = 1000;

/**
 * Maximum length for plan content
 * @deprecated Use MAX_LENGTHS from '../utils/sanitization'
 */
export const MAX_PLAN_LENGTH = 3000;

/**
 * Sanitize context input specifically for the setu_context tool
 *
 * Applies additional restrictions for context that will be persisted
 * and injected into future prompts.
 *
 * @param input - The context input (summary, task, or plan)
 * @param type - The type of context field
 * @returns Sanitized string
 * @deprecated Use createPromptSanitizer() from '../utils/sanitization'
 */
export function sanitizeContextInput(
  input: string,
  type: 'summary' | 'task' | 'plan'
): string {
  const maxLengths = {
    summary: MAX_CONTEXT_LENGTH,
    task: MAX_TASK_LENGTH,
    plan: MAX_PLAN_LENGTH,
  };

  return createPromptSanitizer(maxLengths[type])(input);
}
