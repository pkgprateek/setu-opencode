/**
 * Results Pattern: Step completion tracked by file existence.
 *
 * Instead of database locks or JSONL, we use the filesystem:
 * - Step 3 done? Check if .setu/results/step-3.md exists
 * - Parallel agents write different files, never collide
 * - Human-readable audit trail
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, renameSync, openSync, writeSync, fsyncSync, closeSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { randomBytes } from 'crypto';
import { ensureSetuDir } from './storage';
import { debugLog } from '../debug';

/**
 * Validate project directory path to prevent directory traversal
 * Ensures the resolved path does not contain traversal patterns
 */
function validateProjectDir(projectDir: string): void {
  // Prevent null bytes and control characters
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char detection for security
  if (/[\x00-\x1f]/.test(projectDir)) {
    throw new Error('Invalid characters in project directory path');
  }

  // SECURITY: Check for path traversal attempts BEFORE normalization
  // This catches attempts like "../../../etc/passwd" before resolve() normalizes them
  if (projectDir.includes('..')) {
    throw new Error('Invalid projectDir: path traversal detected');
  }

  const resolved = normalize(resolve(projectDir));

  // Additional check: ensure resolved path doesn't contain '..' (shouldn't happen after resolve, but defense in depth)
  if (resolved.includes('..')) {
    throw new Error('Invalid projectDir: path traversal detected after resolution');
  }
}

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

/**
 * Parse and validate status string
 */
function parseStatus(s: string | undefined): StepResult['status'] {
  return VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]) 
    ? (s as StepResult['status']) 
    : 'completed';
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

/**
 * Sanitize string for YAML frontmatter (defense-in-depth)
 * Prevents YAML injection via control characters, newlines, colons, or comment chars.
 */
export function sanitizeYamlString(str: string): string {
  return str
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char removal
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, ' ')
    // Only replace colons at line start or after whitespace to preserve URLs
    .replace(/(^|\s):/g, '$1-')
    .replace(/#/g, '\\#')
    .slice(0, 2000)
    .trim();
}

/**
 * Format step result as Markdown with YAML frontmatter
 */
function formatResultMarkdown(result: StepResult): string {
  // Sanitize each output entry for YAML safety
  const sanitizeOutput = (o: string): string => {
    return o
      // biome-ignore-next-line lint/suspicious/noControlCharactersInRegex: intentional control char removal
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/:/g, '\\:') // Escape colons
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim();
  };

  const outputsList =
    result.outputs.length > 0
      ? result.outputs.map((o) => `  - ${sanitizeOutput(o)}`).join('\n')
      : '  - (none)';

  // Sanitize user-influenced fields for YAML safety
  const safeObjective = sanitizeYamlString(result.objective);
  const safeSummary = sanitizeYamlString(result.summary);
  const safeVerification = result.verification
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char removal for security
    ? result.verification.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 10000)
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
    debugLog('Failed to parse step result markdown:', error instanceof Error ? error.message : error);
    return null;
  }
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
  const MAX_SIZE = 100 * 1024;
  if (Buffer.byteLength(content, 'utf8') > MAX_SIZE) {
    // Iteratively truncate verification field to fit
    let truncatedResult = { ...result };
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    while (Buffer.byteLength(content, 'utf8') > MAX_SIZE && attempts < MAX_ATTEMPTS) {
      attempts++;
      const currentSize = Buffer.byteLength(content, 'utf8');
      const overflow = currentSize - MAX_SIZE;

      if (truncatedResult.verification && truncatedResult.verification.length > overflow + 100) {
        // Remove more characters from verification
        truncatedResult.verification = truncatedResult.verification.slice(0, truncatedResult.verification.length - overflow - 100) + '\n[TRUNCATED]';
        content = formatResultMarkdown(truncatedResult);
      } else {
        // Can't truncate enough, throw error
        break;
      }
    }

    // Final validation
    if (Buffer.byteLength(content, 'utf8') > MAX_SIZE) {
      throw new Error(`Step result exceeds 100KB limit (${Buffer.byteLength(content, 'utf8')} bytes) even after truncation`);
    }
  }

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
    debugLog(`Failed to read step result ${step} from ${path}:`, error instanceof Error ? error.message : error);
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
    debugLog(`Failed to list completed steps from ${dir}:`, error instanceof Error ? error.message : error);
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
      debugLog(`Failed to delete result file ${f}:`, error instanceof Error ? error.message : error);
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
