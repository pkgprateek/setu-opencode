/**
 * Redaction utilities for debug logging
 * 
 * Prevents accidental leakage of sensitive data in logs.
 */

/**
 * Patterns for data that should be redacted in logs
 */
export const REDACTION_PATTERNS = [
  // API Keys and tokens (various formats)
  { pattern: /\bsk-[A-Za-z0-9]{32,}\b/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { pattern: /\bsk-ant-[A-Za-z0-9-]{40,}\b/g, replacement: '[REDACTED_ANTHROPIC_KEY]' },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { pattern: /\bgho_[A-Za-z0-9]{36}\b/g, replacement: '[REDACTED_GITHUB_OAUTH]' },
  { pattern: /\bAKIA[A-Z0-9]{16}\b/g, replacement: '[REDACTED_AWS_KEY]' },
  { pattern: /\bnpm_[A-Za-z0-9]{36}\b/g, replacement: '[REDACTED_NPM_TOKEN]' },
  
  // Generic long alphanumeric strings that might be tokens
  { pattern: /\b[A-Za-z0-9]{40,}\b/g, replacement: '[REDACTED_LONG_TOKEN]' },
  
  // Password patterns
  { pattern: /password\s*[=:]\s*['"]?[^\s'"]{1,}['"]?/gi, replacement: 'password=[REDACTED]' },
  { pattern: /passwd\s*[=:]\s*['"]?[^\s'"]{1,}['"]?/gi, replacement: 'passwd=[REDACTED]' },
  
  // Secret patterns
  { pattern: /secret\s*[=:]\s*['"]?[^\s'"]{1,}['"]?/gi, replacement: 'secret=[REDACTED]' },
  { pattern: /api[_-]?key\s*[=:]\s*['"]?[^\s'"]{1,}['"]?/gi, replacement: 'apikey=[REDACTED]' },
  
  // Authorization headers
  { pattern: /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]+/gi, replacement: 'Authorization: Bearer [REDACTED]' },
  { pattern: /authorization\s*:\s*basic\s+[A-Za-z0-9+/=]+/gi, replacement: 'Authorization: Basic [REDACTED]' },
  
  // Private keys (just the header, to indicate presence)
  { pattern: /-----BEGIN[A-Z\s]+PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  
  // JWT tokens
  { pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: '[REDACTED_JWT]' },
] as const;

/**
 * Redact sensitive information from a message
 * 
 * Used by debug logging to prevent accidental leakage.
 * 
 * @param message - The message to redact
 * @returns The message with sensitive data redacted
 */
export function redactSensitive(message: string): string {
  // Type safety: always return a string, never null/undefined
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  let redacted = message;
  
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, replacement);
  }
  
  return redacted;
}
