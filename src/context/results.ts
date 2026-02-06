/**
 * Results Pattern: Step completion tracked by file existence.
 *
 * Instead of database locks or JSONL, we use the filesystem:
 * - Step 3 done? Check if .setu/results/step-3.md exists
 * - Parallel agents write different files, never collide
 * - Human-readable audit trail
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, renameSync, openSync, writeSync, fsyncSync, closeSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { ensureSetuDir } from './storage';
import { debugLog } from '../debug';
import { getErrorMessage } from '../utils/error-handling';
import { validateProjectDir } from '../utils/path-validation';
import { createYamlSanitizer, createOutputSanitizer, MAX_LENGTHS } from '../utils/sanitization';

export interface StepResult {
  step: number;
  status: 'completed' | 'failed' | 'skipped';
  objective: string;
  outputs: string[]; // Files created/modified
  summary: string;
  verification?: string; // How we verified
  timestamp: string;
  durationMs?: number;
}

const VALID_STATUSES = ['completed', 'failed', 'skipped'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

/**
 * Type predicate to check if a string is a valid status
 */
function isValidStatus(s: string | undefined): s is ValidStatus {
  return typeof s === 'string' && VALID_STATUSES.includes(s as ValidStatus);
}

/**
 * Parse and validate status string
 * Returns 'failed' for invalid/corrupted data to make failures visible
 */
function parseStatus(s: string | undefined): StepResult['status'] {
  if (isValidStatus(s)) {
    return s;
  }
  // Log warning for corrupted/tampered data
  debugLog(`Warning: Invalid status "${s}" in step result, defaulting to 'failed'`);
  return 'failed';
}

/**
 * Ensure results directory exists
 */
function ensureResultsDir(projectDir: string): string {
  validateProjectDir(projectDir);
  const resultsDir = join(projectDir, '.setu', 'results');
  if (!existsSync(resultsDir)) {
    ensureSetuDir(projectDir);
    mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

// Create sanitizers for reuse
const yamlSanitizer = createYamlSanitizer(MAX_LENGTHS.YAML_FIELD);
const outputSanitizer = createOutputSanitizer();
const verificationSanitizer = createYamlSanitizer(MAX_LENGTHS.VERIFICATION);

/**
 * Format step result as Markdown with YAML frontmatter
 */
function formatResultMarkdown(result: StepResult): string {
  const outputsList =
    result.outputs.length > 0
      ? result.outputs.map((o) => `  - ${outputSanitizer(o)}`).join('\n')
      : '  - (none)';

  // Sanitize user-influenced fields for YAML safety
  const safeObjective = yamlSanitizer(result.objective);
  const safeSummary = yamlSanitizer(result.summary);
  const safeVerification = result.verification
    ? verificationSanitizer(result.verification)
    : undefined;

  return `---
step: ${result.step}
status: ${result.status}
timestamp: ${result.timestamp}
${result.durationMs ? `duration_ms: ${result.durationMs}\n` : ''}outputs:
${outputsList}
---

# Step ${result.step}: ${safeObjective}

## Summary

${safeSummary}

${safeVerification ? `## Verification

${safeVerification}
` : ''}`;
}

/**
 * Parse step result from Markdown with YAML frontmatter
 */
function parseResultMarkdown(content: string): StepResult | null {
  try {
    // Simple YAML frontmatter parsing
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length);

    // Extract fields from frontmatter
    const stepMatch = frontmatter.match(/step:\s*(\d+)/);
    const statusMatch = frontmatter.match(/status:\s*(\w+)/);
    const timestampMatch = frontmatter.match(/timestamp:\s*(.+)/);
    const durationMatch = frontmatter.match(/duration_ms:\s*(\d+)/);

    // Extract outputs (simple parsing)
    const outputsMatch = frontmatter.match(/outputs:\n((?:\s+-\s+.+\n?)*)/);
    const outputs = outputsMatch
      ? outputsMatch[1]
          .split('\n')
          .filter((l) => l.trim().startsWith('-'))
          .map((l) => l.replace(/^\s+-\s+/, '').trim())
      : [];

    // Extract objective from heading
    const objectiveMatch = body.match(/# Step \d+:\s*(.+)/);

    // Extract summary
    const summaryMatch = body.match(/## Summary\n\n([\s\S]*?)(?=\n## |$)/);

    // Extract verification
    const verificationMatch = body.match(/## Verification\n\n([\s\S]*?)(?=\n## |$)/);

    return {
      step: parseInt(stepMatch?.[1] || '0'),
      status: parseStatus(statusMatch?.[1]),
      timestamp: timestampMatch?.[1] || new Date().toISOString(),
      durationMs: durationMatch ? parseInt(durationMatch[1]) : undefined,
      outputs: outputs.filter((o) => o !== '(none)'),
      objective: objectiveMatch?.[1]?.trim() || 'Unknown',
      summary: summaryMatch?.[1]?.trim() || '',
      verification: verificationMatch?.[1]?.trim(),
    };
  } catch (error) {
    debugLog('Failed to parse step result markdown:', getErrorMessage(error));
    return null;
  }
}

/**
 * Enhanced truncation strategy for size limits
 * 
 * Priority order for truncation (least important first):
 * 1. Verification (can be truncated significantly - up to 90%)
 * 2. Summary (can be truncated moderately - up to 50%)
 * 3. Objective (truncate only as last resort - up to 20%)
 * 
 * Never truncate below MIN_FIELD_LENGTH characters.
 */
const MIN_FIELD_LENGTH = 100;

function truncateResultToFit(result: StepResult, formattedContent: string, maxBytes: number): string {
  let currentContent = formattedContent;
  
  // Priority order for truncation (least important first)
  const truncatePhases: Array<{
    field: 'verification' | 'summary' | 'objective';
    maxReduction: number;
  }> = [
    { field: 'verification', maxReduction: 0.9 }, // Up to 90%
    { field: 'summary', maxReduction: 0.5 },      // Up to 50%
    { field: 'objective', maxReduction: 0.2 },    // Up to 20%
  ];
  
  let truncatedResult = { ...result };
  
  for (const phase of truncatePhases) {
    if (Buffer.byteLength(currentContent, 'utf8') <= maxBytes) {
      break; // Done, content fits
    }

    // Safely get field value with type guard
    const fieldValue = truncatedResult[phase.field];
    if (typeof fieldValue !== 'string' || fieldValue.length <= MIN_FIELD_LENGTH) {
      continue; // Can't truncate this field further
    }

    const currentBytes = Buffer.byteLength(currentContent, 'utf8');
    const overflow = currentBytes - maxBytes;
    // Byte-aware truncation for multi-byte UTF-8 content
    const fieldBytes = Buffer.byteLength(fieldValue, 'utf8');
    const bytesPerChar = fieldBytes / fieldValue.length;
    const maxBytesToRemove = Math.floor(fieldBytes * phase.maxReduction);
    const reductionBytes = Math.min(overflow + 100, maxBytesToRemove);

    if (reductionBytes <= 0) {
      continue;
    }

    // Convert byte reduction to character reduction, accounting for multi-byte chars
    const reductionChars = Math.ceil(reductionBytes / bytesPerChar);
    const newLength = Math.max(MIN_FIELD_LENGTH, fieldValue.length - reductionChars);
    // Safe assignment with type-checked field access
    switch (phase.field) {
      case 'verification':
        truncatedResult.verification = fieldValue.slice(0, newLength) + '\n[TRUNCATED]';
        break;
      case 'summary':
        truncatedResult.summary = fieldValue.slice(0, newLength) + '\n[TRUNCATED]';
        break;
      case 'objective':
        truncatedResult.objective = fieldValue.slice(0, newLength) + '\n[TRUNCATED]';
        break;
    }
    currentContent = formatResultMarkdown(truncatedResult);
  }
  
  // Final validation
  if (Buffer.byteLength(currentContent, 'utf8') > maxBytes) {
    throw new Error(
      `Step result exceeds ${maxBytes} bytes limit (${Buffer.byteLength(currentContent, 'utf8')} bytes) even after truncation. ` +
      'Consider reducing the size of the objective, summary, or verification fields.'
    );
  }
  
  return currentContent;
}

/**
 * Write step result to .setu/results/step-N.md
 */
export function writeStepResult(projectDir: string, result: StepResult): void {
  // Validate step number
  if (!Number.isInteger(result.step) || result.step <= 0) {
    throw new Error(`Invalid step number: ${result.step} (must be positive integer)`);
  }

  const resultsDir = ensureResultsDir(projectDir);
  let content = formatResultMarkdown(result);

  // Enforce 100KB limit using byte length (UTF-8)
  content = truncateResultToFit(result, content, 100 * 1024);

  // Atomic write: write to temp file, then rename
  const targetPath = join(resultsDir, `step-${result.step}.md`);
  // SECURITY: Use 16 bytes (32 hex chars) for collision resistance in parallel execution
  const tempPath = `${targetPath}.${randomBytes(16).toString('hex')}.tmp`;

  // Write to temp file with explicit sync
  let fd: number | undefined;
  try {
    fd = openSync(tempPath, 'w');
    writeSync(fd, content, 0, 'utf-8');
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined; // Mark as closed
    // Atomic rename
    renameSync(tempPath, targetPath);
  } catch (error) {
    // Clean up temp file if it exists
    if (fd !== undefined) {
      try { closeSync(fd); } catch {}
    }
    try { unlinkSync(tempPath); } catch {}
    throw error;
  }
}

/**
 * Read step result from .setu/results/step-N.md
 * Returns null if step not completed
 */
export function readStepResult(projectDir: string, step: number): StepResult | null {
  validateProjectDir(projectDir);
  if (!Number.isInteger(step) || step <= 0) {
    debugLog(`Invalid step parameter: ${step} (must be positive integer)`);
    return null;
  }
  const path = join(projectDir, '.setu', 'results', `step-${step}.md`);
  if (!existsSync(path)) return null;
  try {
    return parseResultMarkdown(readFileSync(path, 'utf-8'));
  } catch (error) {
    debugLog(`Failed to read step result ${step} from ${path}:`, getErrorMessage(error));
    return null;
  }
}

/**
 * List all completed steps (sorted)
 */
export function listCompletedSteps(projectDir: string): number[] {
  validateProjectDir(projectDir);
  const dir = join(projectDir, '.setu', 'results');
  if (!existsSync(dir)) return [];

  try {
    return readdirSync(dir)
      .filter((f) => /^step-\d+\.md$/.test(f))
      .map((f) => parseInt(f.match(/step-(\d+)/)?.[1] || '0'))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
  } catch (error) {
    debugLog(`Failed to list completed steps from ${dir}:`, getErrorMessage(error));
    return [];
  }
}

/**
 * Clear all result files (for new plan)
 */
export function clearResults(projectDir: string): void {
  validateProjectDir(projectDir);
  const dir = join(projectDir, '.setu', 'results');
  if (!existsSync(dir)) return;

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const f of files) {
    try {
      unlinkSync(join(dir, f));
    } catch (error) {
      // Log but continue - one failure shouldn't abort cleanup
      debugLog(`Failed to delete result file ${f}:`, getErrorMessage(error));
    }
  }
}

/**
 * Get last completed step number
 */
export function getLastCompletedStep(projectDir: string): number {
  const steps = listCompletedSteps(projectDir);
  return steps.length > 0 ? Math.max(...steps) : 0;
}
