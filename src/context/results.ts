/**
 * Results Pattern: Step completion tracked by file existence.
 *
 * Instead of database locks or JSONL, we use the filesystem:
 * - Step 3 done? Check if .setu/results/step-3.md exists
 * - Parallel agents write different files, never collide
 * - Human-readable audit trail
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ensureSetuDir } from './storage';
import { debugLog } from '../debug';

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

/**
 * Ensure results directory exists
 */
function ensureResultsDir(projectDir: string): string {
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
 *
 * @see docs/internal/Audit.md - YAML Injection Risk analysis
 */
export function sanitizeYamlString(str: string): string {
  return str
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char removal
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\n/g, ' ')
    .replace(/:/g, ' -')
    .replace(/#/g, '')
    .slice(0, 200)
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

${result.verification ? `## Verification

${result.verification}
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
      status: (statusMatch?.[1] as StepResult['status']) || 'completed',
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

  // Enforce 50KB limit using byte length (UTF-8)
  const MAX_SIZE = 50 * 1024;
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
      throw new Error(`Step result exceeds 50KB limit (${Buffer.byteLength(content, 'utf8')} bytes) even after truncation`);
    }
  }

  writeFileSync(join(resultsDir, `step-${result.step}.md`), content, 'utf-8');
}

/**
 * Read step result from .setu/results/step-N.md
 * Returns null if step not completed
 */
export function readStepResult(projectDir: string, step: number): StepResult | null {
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
