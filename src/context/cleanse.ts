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

import { resolve, normalize } from 'path';
import { loadActiveTask } from './active';
import { readStepResult } from './results';
import { errorLog } from '../debug';

/**
 * Validate and sanitize project directory path
 * Prevents directory traversal attacks
 */
function validateProjectDir(dir: string): string {
  // Prevent null bytes and control characters
  if (/[\x00-\x1f]/.test(dir)) {
    throw new Error('Invalid characters in project directory path');
  }

  // SECURITY: Check for path traversal attempts BEFORE normalization
  // This catches attempts like "../../../etc/passwd" before resolve() normalizes them
  if (dir.includes('..')) {
    throw new Error('Invalid projectDir: path traversal detected');
  }

  const resolved = normalize(resolve(dir));

  // Additional check: ensure resolved path doesn't contain '..' (shouldn't happen after resolve, but defense in depth)
  if (resolved.includes('..')) {
    throw new Error('Invalid projectDir: path traversal detected after resolution');
  }

  return resolved;
}

/**
 * Sanitize objective input to prevent prompt injection
 * Removes null bytes and control characters (except newlines/tabs)
 */
function sanitizeObjective(input: string): string {
  // Remove null bytes and control characters (except newlines/tabs)
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
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
  // SECURITY: Validate and sanitize inputs
  const safeDir = validateProjectDir(projectDir);
  const safeObjective = sanitizeObjective(objective);

  let active;
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
  // @see docs/internal/Audit.md - Prompt Injection Risk analysis
  let prevSummary = '';
  if (lastStep > 0) {
    try {
      const prevResult = readStepResult(safeDir, lastStep);
      if (prevResult) {
        const truncatedSummary = prevResult.summary?.slice(0, 500) || '';
        prevSummary = `\n## Previous Step (${lastStep}) Summary\n${truncatedSummary}\n`;
      }
    } catch {
      // Non-fatal: previous step summary is optional
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
  const maxChars = (options.maxTokens ?? 2000) * 4; // ~4 chars per token
  if (context.length > maxChars) {
    context = context.slice(0, maxChars - 20) + '\n[TRUNCATED]';
  }

  return context;
}

/**
 * Get summary of JIT context (for debugging)
 */
export function getJITContextSummary(projectDir: string): JITContext {
  const safeDir = validateProjectDir(projectDir);

  let active;
  try {
    active = loadActiveTask(safeDir);
  } catch {
    // Return safe default on error
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
}
