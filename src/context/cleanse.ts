/**
 * Cleanse Protocol: JIT context preparation for subagents.
 *
 * Philosophy: Don't parse PLAN.md — tell subagent where to find its step.
 * The LLM reads markdown naturally. Trust it.
 *
 * This is more elegant than:
 * - beads: External DB + manual bd prime
 * - GSD: Spawn fresh 200k agent per task (expensive)
 *
 * We just tell the subagent: "Find Step N in PLAN.md"
 */

import { loadActiveTask } from './active';
import { readStepResult } from './results';
import { errorLog } from '../debug';
import { validateAndResolveProjectDir } from '../utils/path-validation';
import { getErrorMessage } from '../utils/error-handling';

/**
 * Sanitize objective input to prevent prompt injection
 * Removes null bytes and control characters (except newlines/tabs)
 */
function sanitizeObjective(input: string): string {
  // Remove null bytes and control characters (except newlines/tabs) using charCodeAt
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Allow: 0x09 (tab), 0x0a (newline), 0x0d (carriage return)
    // Remove: 0x00-0x08, 0x0b, 0x0c, 0x0e-0x1f, 0x7f
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    result += input[i];
  }
  return result;
}

export interface CleanseOptions {
  mode: 'full' | 'focused';
  maxTokens?: number; // Default 2000, truncates if exceeded
}

export interface JITContext {
  step: number;
  objective: string;
  failedApproaches: string[];
  constraints: string[];
  previousStepSummary?: string;
}

/**
 * Prepare JIT context for a subagent
 *
 * @param projectDir - Project root directory
 * @param objective - What the subagent should accomplish
 * @param options - Cleanse options
 * @returns Formatted context string for injection
 */
export function prepareJITContext(
  projectDir: string,
  objective: string,
  options: CleanseOptions = { mode: 'full', maxTokens: 2000 }
): string {
  try {
    // SECURITY: Validate and sanitize inputs
    const safeDir = validateAndResolveProjectDir(projectDir);
    const safeObjective = sanitizeObjective(objective);

    let active: ReturnType<typeof loadActiveTask>;
    try {
      active = loadActiveTask(safeDir);
    } catch (err) {
      // Fail-safe: return minimal context if state corrupted
      errorLog('Failed to load active task for JIT context:', err);
      return `[SETU: JIT Context - Recovery Mode]

## Your Objective
${safeObjective}

Context unavailable. Read .setu/PLAN.md directly.`;
    }

    // Calculate which step comes next
    const lastStep = active?.progress?.lastCompletedStep ?? 0;
    const nextStep = lastStep + 1;

    // Get failed approaches to inject (prevents ghost loops)
    // Defense-in-depth: Truncate each approach to prevent prompt bloat
    const failed = (active?.learnings?.failed?.slice(-3) || []).map((a) => a.slice(0, 200));

    // Get constraints (already whitelist-validated by setu_task, safe to use directly)
    const constraints = active?.constraints || [];

    // Get previous step summary (for context continuity)
    // Defense-in-depth: Limit summary length to prevent prompt bloat
    let prevSummary = '';
    if (lastStep > 0) {
      try {
        const prevResult = readStepResult(safeDir, lastStep);
        if (prevResult) {
          const truncatedSummary = prevResult.summary?.slice(0, 500) || '';
          prevSummary = `\n## Previous Step (${lastStep}) Summary\n${truncatedSummary}\n`;
        }
      } catch (err) {
        // Non-fatal: previous step summary is optional, but log for traceability
        errorLog(`Failed to read previous step result: step ${lastStep}`, getErrorMessage(err));
      }
    }

    // Build the JIT context prompt
    let context = `[SETU: JIT Context - Step ${nextStep}]

## Your Objective
${safeObjective}

## Current Position
Last completed: Step ${lastStep}${lastStep === 0 ? ' (starting fresh)' : ''}
Your step: Step ${nextStep}

## How to Execute
1. Read .setu/PLAN.md
2. Find Step ${nextStep}
3. Execute its instructions
4. Call setu_verify when complete

## Artifacts Available
- .setu/PLAN.md — Find your step here
- .setu/RESEARCH.md — Background context if needed
- .setu/results/step-{N}.md — Previous step outputs
${prevSummary}${constraints.length > 0 ? `## Active Constraints
${constraints.map((c) => `- ${c}`).join('\n')}
` : ''}${failed.length > 0 ? `## Failed Approaches (DO NOT REPEAT)
${failed.map((a) => `- ${a}`).join('\n')}

Learn from these failures. Try a different approach.
` : ''}---
Start by reading .setu/PLAN.md to find Step ${nextStep}.`;

    // Simple truncation if over budget
    const maxTokens = options.maxTokens ?? 2000;
    if (maxTokens <= 0) {
      // Return minimal context when budget is zero or negative
      return `[SETU: JIT Context - Step ${nextStep}]

## Your Objective
${safeObjective}

[Context truncated due to token budget]`;
    }
    const maxChars = maxTokens * 4; // ~4 chars per token
    if (context.length > maxChars) {
      const safeMaxChars = Math.max(100, maxChars - 20); // Ensure at least 100 chars
      context = context.slice(0, safeMaxChars) + '\n[TRUNCATED]';
    }

    return context;
  } catch (error) {
    // All errors (including validation) return recovery mode
    errorLog('JIT context preparation failed:', getErrorMessage(error));
    const safeObjective = typeof objective === 'string' ? sanitizeObjective(objective) : sanitizeObjective('');
    return `[SETU: JIT Context - Recovery Mode]

## Your Objective
${safeObjective}

Context unavailable due to error. Read .setu/PLAN.md directly.`;
  }
}

/**
 * Get summary of JIT context (for debugging)
 */
export function getJITContextSummary(projectDir: string): JITContext {
  try {
    const safeDir = validateAndResolveProjectDir(projectDir);

    let active: ReturnType<typeof loadActiveTask>;
    try {
      active = loadActiveTask(safeDir);
    } catch (err) {
      // Return safe default on error, but log for traceability
      errorLog('Failed to load active task for JIT summary:', getErrorMessage(err));
      return {
        step: 1,
        objective: 'Unknown (context unavailable)',
        failedApproaches: [],
        constraints: [],
      };
    }

    const lastStep = active?.progress?.lastCompletedStep ?? 0;

    return {
      step: lastStep + 1,
      objective: active?.task || 'Unknown',
      failedApproaches: active?.learnings?.failed?.slice(-3) || [],
      constraints: active?.constraints || [],
    };
  } catch (error) {
    // All errors (including validation) return safe default
    errorLog('JIT context summary failed:', getErrorMessage(error));
    return {
      step: 1,
      objective: 'Unknown (context unavailable)',
      failedApproaches: [],
      constraints: [],
    };
  }
}
