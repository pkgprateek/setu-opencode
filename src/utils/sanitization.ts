/**
 * Unified sanitization pipeline
 *
 * Composable sanitization filters that can be combined
 * for different use cases across the codebase.
 *
 * This centralizes all sanitization logic to ensure consistent
 * security checks and prevent code duplication.
 */

/**
 * Type for a sanitization filter function
 */
export type SanitizationFilter = (input: string) => string;

// ============================================================================
// Base Filters
// ============================================================================

/**
 * Remove control characters (0x00-0x1F and 0x7F)
 */
export const removeControlChars: SanitizationFilter = (input) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char removal
  input.replace(/[\x00-\x1F\x7F]/g, '');

/**
 * Escape backslashes for YAML safety
 */
export const escapeBackslashes: SanitizationFilter = (input) =>
  input.replace(/\\/g, '\\\\');

/**
 * Escape double quotes for YAML safety
 */
export const escapeQuotes: SanitizationFilter = (input) =>
  input.replace(/"/g, '\\"');

/**
 * Replace newlines and carriage returns with spaces
 * Handles \n, \r, and \r\n sequences
 */
export const removeNewlines: SanitizationFilter = (input) =>
  input.replace(/[\r\n]+/g, ' ');

/**
 * Replace colons at line start, after whitespace, or followed by space (YAML safety)
 * Preserves colons in URLs and other contexts
 */
export const sanitizeColons: SanitizationFilter = (input) =>
  input.replace(/(^|\s):|:\s+/g, (_match, capture) => {
    // If we matched (^|\s):, preserve the whitespace and replace colon with hyphen
    if (capture !== undefined) {
      return (capture || '') + '-';
    }
    // If we matched :\s+, replace colon and space with hyphen
    return '-';
  });

/**
 * Escape hash symbols for YAML safety
 */
export const escapeHashes: SanitizationFilter = (input) =>
  input.replace(/#/g, '\\#');

/**
 * Create a truncate filter with specified max length
 * Validates maxLength to ensure it's a positive finite integer
 */
export const truncate = (maxLength: number): SanitizationFilter => {
  if (typeof maxLength !== 'number' || !Number.isFinite(maxLength) || maxLength <= 0) {
    throw new RangeError(`maxLength must be a positive finite number, got ${maxLength}`);
  }
  const validatedLength = Math.floor(maxLength);
  return (input) => input.slice(0, validatedLength);
};

/**
 * Remove system instruction patterns (prompt injection prevention)
 */
export const removeSystemPatterns: SanitizationFilter = (input) => {
  const patterns = [
    /\[SYSTEM\]/gi,
    /\[ASSISTANT\]/gi,
    /\[USER\]/gi,
    /\[SETU\]/gi,
    /\[ADMIN\]/gi,
    /\[OVERRIDE\]/gi,
    /<\s*system\s*>/gi,
    /<\s*\/\s*system\s*>/gi,
    /^---$/gm,
    /^```\s*yaml\s*$/gmi,
  ];

  return patterns.reduce((acc, pattern) => acc.replace(pattern, '[FILTERED]'), input);
};

/**
 * Remove instruction boundary patterns (prompt injection prevention)
 */
export const removeInstructionBoundaries: SanitizationFilter = (input) => {
  const patterns = [
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
    /DAN\s+(mode)?/gi,
  ];

  return patterns.reduce((acc, pattern) => acc.replace(pattern, '[FILTERED]'), input);
};

/**
 * Escape markdown code blocks
 */
export const escapeCodeBlocks: SanitizationFilter = (input) =>
  input.replace(/```/g, '\\`\\`\\`');

/**
 * Escape HTML-like tags
 * Handles: <tag>, </tag>, <tag attr="value">, <tag/>, <ns:tag>
 */
export const escapeHtmlTags: SanitizationFilter = (input) =>
  input.replace(/<[^>]+>/g, (match) => match.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

// ============================================================================
// Composite Pipelines
// ============================================================================

/**
 * Maximum lengths for different context types
 */
export const MAX_LENGTHS = {
  YAML_FIELD: 2000,
  VERIFICATION: 10000,
  CONTEXT: 5000,
  TASK: 1000,
  PLAN: 3000,
} as const;

/**
 * Create a YAML sanitizer pipeline
 *
 * Use for: YAML frontmatter, structured data
 * Output: Safe for YAML parsing
 */
export function createYamlSanitizer(maxLength: number = MAX_LENGTHS.YAML_FIELD): SanitizationFilter {
  return (input: string): string => {
    // Validate null/undefined at API boundary
    if (!input || typeof input !== 'string') {
      return '';
    }

    const pipeline = [
      removeControlChars,
      escapeBackslashes,
      escapeQuotes,
      removeNewlines,
      sanitizeColons,
      escapeHashes,
      truncate(maxLength),
    ];

    return pipeline.reduce((acc, filter) => filter(acc), input).trim();
  };
}

/**
 * Create a prompt sanitizer pipeline
 *
 * Use for: User input injected into prompts
 * Output: Safe from prompt injection attacks
 */
export function createPromptSanitizer(maxLength: number = MAX_LENGTHS.CONTEXT): SanitizationFilter {
  return (input: string): string => {
    if (!input || typeof input !== 'string') {
      return '';
    }

    const suffix = '\n... (truncated for safety)';

    // Apply filters first
    const filtered = [
      removeControlChars,
      removeSystemPatterns,
      removeInstructionBoundaries,
      escapeCodeBlocks,
      escapeHtmlTags,
    ].reduce((acc, filter) => filter(acc), input);

    // Check if we need to truncate
    const wasTruncated = filtered.length > maxLength;
    let result = filtered;

    if (wasTruncated) {
      // Truncate and add suffix, ensuring final length never exceeds maxLength
      const take = Math.max(0, maxLength - suffix.length);
      if (take > 0) {
        result = filtered.slice(0, take) + suffix;
      } else {
        // Suffix alone exceeds maxLength, truncate suffix itself
        result = suffix.slice(0, maxLength);
      }
    }

    return result.trim();
  };
}

/**
 * Normalize path separators (convert backslashes to forward slashes)
 */
const normalizeSeparators: SanitizationFilter = (input) =>
  input.replace(/\\/g, '/');

/**
 * Iteratively percent-decode input until no more changes
 * Handles: %2f, %5c, %252f (double-encoded), etc.
 */
const percentDecode: SanitizationFilter = (input) => {
  let result = input;
  let previous;
  do {
    previous = result;
    result = result.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
  } while (result !== previous);
  return result;
};

/**
 * Remove null bytes from input
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char removal
const removeNullBytes: SanitizationFilter = (input) =>
  input.replace(/\x00/g, '');

/**
 * Remove path traversal sequences (handles encoded and normalized forms)
 */
const removePathTraversal: SanitizationFilter = (input) =>
  // Remove ../, ..\, /.., \.. and their variations
  input.replace(/\.\.[/\\]|[/\\]\.\./g, '').replace(/\.\./g, '');

/**
 * Maximum length for output sanitization to prevent DoS
 */
const MAX_OUTPUT_SANITIZE_LENGTH = 10000;

/**
 * Check if string is a Windows absolute path (e.g., C:\file.txt or C:/file.txt)
 * 
 * Note: UNC paths (\\server\share) are NOT considered Windows absolute paths here.
 * This is intentional - UNC path colons get escaped for YAML safety, while drive
 * letter colons are preserved. This is correct behavior for YAML sanitization.
 */
const isWindowsAbsolutePath = (input: string): boolean =>
  /^[A-Za-z]:[\\/]/.test(input);

/**
 * Escape colons in paths, but preserve Windows drive letter colons
 */
const escapeColonsSafe: SanitizationFilter = (input) => {
  if (isWindowsAbsolutePath(input)) {
    // For Windows paths, preserve the drive letter colon (position 1)
    return input[0] + ':' + input.slice(2).replace(/:/g, '\\:');
  }
  return input.replace(/:/g, '\\:');
};

/**
 * Create an output sanitizer for file lists in YAML
 *
 * Use for: Output file paths in YAML frontmatter
 * Output: Safe for YAML list items
 */
export function createOutputSanitizer(): SanitizationFilter {
  return (input: string): string => {
    // Validate null/undefined at API boundary
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Enforce max length to prevent DoS
    let truncated = input;
    if (input.length > MAX_OUTPUT_SANITIZE_LENGTH) {
      truncated = input.slice(0, MAX_OUTPUT_SANITIZE_LENGTH) + '...[truncated]';
    }

    const pipeline = [
      removeControlChars,
      removeNullBytes,
      percentDecode,
      normalizeSeparators,
      removePathTraversal,
      escapeColonsSafe, // Safe colon escaping that preserves Windows paths
      removeNewlines,
    ];

    return pipeline.reduce((acc, filter) => filter(acc), truncated).trim();
  };
}

// ============================================================================
// Convenience Functions (Backward Compatibility)
// ============================================================================

/**
 * Sanitize string for YAML frontmatter (backward compatible)
 * @deprecated Use createYamlSanitizer() for new code
 */
export function sanitizeYamlString(str: string, maxLength = MAX_LENGTHS.YAML_FIELD): string {
  // Validate null/undefined for consistent fail-safe behavior
  if (!str || typeof str !== 'string') {
    return '';
  }
  return createYamlSanitizer(maxLength)(str);
}

/**
 * Sanitize for prompt injection (backward compatible)
 * @deprecated Use createPromptSanitizer() for new code
 */
export function sanitizeForPrompt(input: string, maxLength = MAX_LENGTHS.CONTEXT): string {
  // Validate null/undefined for consistent fail-safe behavior
  if (!input || typeof input !== 'string') {
    return '';
  }
  return createPromptSanitizer(maxLength)(input);
}

/**
 * Sanitize output entry for YAML list (backward compatible)
 * @deprecated Use createOutputSanitizer() for new code
 */
export function sanitizeOutputEntry(output: string): string {
  // Validate null/undefined for consistent fail-safe behavior
  if (!output || typeof output !== 'string') {
    return '';
  }
  return createOutputSanitizer()(output);
}
