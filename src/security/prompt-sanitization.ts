/**
 * Prompt sanitization for injection prevention
 * 
 * Sanitizes user-provided content before injection into system prompts.
 * Prevents prompt injection attacks where users try to override Setu's instructions.
 */

/**
 * Maximum length for context fields to prevent DoS via large payloads
 */
export const MAX_CONTEXT_LENGTH = 5000;
export const MAX_TASK_LENGTH = 1000;
export const MAX_PLAN_LENGTH = 3000;

/**
 * Patterns that look like system instructions
 */
const SYSTEM_INSTRUCTION_PATTERNS = [
  /\[SYSTEM\]/gi,
  /\[ASSISTANT\]/gi,
  /\[USER\]/gi,
  /\[SETU\]/gi,
  /\[ADMIN\]/gi,
  /\[OVERRIDE\]/gi,
  /<\s*system\s*>/gi,
  /<\s*\/\s*system\s*>/gi,
  /^---$/gm,  // YAML frontmatter delimiters
  /^```\s*yaml\s*$/gmi,  // Code blocks that might contain config
];

/**
 * Patterns that might try to end/restart instructions
 */
const INSTRUCTION_BOUNDARY_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /forget\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?previous/gi,
  /new\s+instructions?:/gi,
  /you\s+are\s+now\s+in\s+(\w+\s+)?mode/gi,
  /bypass\s+(all\s+)?safety/gi,
  /override\s+(all\s+)?restrictions?/gi,
  /admin(istrator)?\s+mode/gi,
  /god\s+mode/gi,
  /jailbreak/gi,
  /DAN\s+(mode)?/gi,  // Common jailbreak name
];

/**
 * Sanitize a string for safe injection into prompts
 * 
 * This function:
 * 1. Removes system-like prefixes that could confuse the model
 * 2. Removes instruction override attempts
 * 3. Escapes markdown that could hide malicious content
 * 4. Truncates to prevent DoS
 * 
 * @param input - User-provided string
 * @param maxLength - Maximum allowed length (defaults to MAX_CONTEXT_LENGTH)
 * @returns Sanitized string safe for prompt injection
 */
export function sanitizeForPrompt(input: string, maxLength: number = MAX_CONTEXT_LENGTH): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Step 1: Remove system instruction patterns
  for (const pattern of SYSTEM_INSTRUCTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }
  
  // Step 2: Remove instruction boundary attempts
  for (const pattern of INSTRUCTION_BOUNDARY_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }
  
  // Step 3: Escape triple backticks (could hide instructions in code blocks)
  sanitized = sanitized.replace(/```/g, '\\`\\`\\`');
  
  // Step 4: Escape HTML-like tags that might confuse parsing
  sanitized = sanitized.replace(/<([a-z]+)>/gi, '&lt;$1&gt;');
  sanitized = sanitized.replace(/<\/([a-z]+)>/gi, '&lt;/$1&gt;');
  
  // Step 5: Truncate to max length
  if (sanitized.length > maxLength) {
    const suffix = '\n... (truncated for safety)';
    if (suffix.length >= maxLength) {
      // Edge case: suffix itself is longer than maxLength
      sanitized = suffix.slice(0, maxLength);
    } else {
      sanitized = sanitized.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
    }
  }
  
  // Step 6: Trim whitespace
  return sanitized.trim();
}

/**
 * Sanitize context input specifically for the setu_context tool
 * 
 * Applies additional restrictions for context that will be persisted
 * and injected into future prompts.
 * 
 * @param input - The context input (summary, task, or plan)
 * @param type - The type of context field
 * @returns Sanitized string
 */
export function sanitizeContextInput(
  input: string,
  type: 'summary' | 'task' | 'plan'
): string {
  const maxLengths = {
    summary: MAX_CONTEXT_LENGTH,
    task: MAX_TASK_LENGTH,
    plan: MAX_PLAN_LENGTH
  };
  
  return sanitizeForPrompt(input, maxLengths[type]);
}
