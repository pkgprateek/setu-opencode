import { tool } from '@opencode-ai/plugin';
import { validateProjectDir } from '../utils/path-validation';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { setQuestionBlocked } from '../context';
import { resetProgress } from '../context/active';
import { ensureSetuDir } from '../context/storage';
import { clearResults } from '../context/results';
import { getErrorMessage } from '../utils/error-handling';
import { createPromptSanitizer } from '../utils/sanitization';
import { debugLog } from '../debug';

// Create sanitizers for different field lengths
const sanitizeObjective = createPromptSanitizer(500);
const sanitizeContextSummary = createPromptSanitizer(1000);
const sanitizeSteps = createPromptSanitizer(10000); // Steps can be longer
const sanitizeSuccessCriteria = createPromptSanitizer(2000);

export function countStructuredSteps(rawSteps: string): number {
  const lines = rawSteps.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      /^(#{2,6})\s*(?:step|task|phase|item)?\s*\d*[:.-]?\s+.+$/i.test(trimmed) ||
      /^\d+\s*[.)-:]\s+.+$/.test(trimmed) ||
      /^[-*]\s+.+$/.test(trimmed)
    ) {
      count++;
    }
  }
  return count;
}

export function normalizeUnstructuredSteps(rawSteps: string): string {
  const compact = rawSteps.replace(/\s+/g, ' ').trim();
  if (!compact) {
    return `## Step 1: Implement requested change\n- Apply the requested update safely.\n\n## Step 2: Verify result\n- Validate output and report completion.`;
  }

  const sentenceCandidates = compact
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  const first = sentenceCandidates[0] ?? 'Implement the requested change.';
  const second = sentenceCandidates[1] ?? 'Verify the result and confirm completion.';

  return `## Step 1: Execute request\n- ${first}\n\n## Step 2: Verify outcome\n- ${second}`;
}

export function normalizeStepsInput(rawSteps: string): { steps: string; stepCount: number } {
  const structuredCount = countStructuredSteps(rawSteps);
  if (structuredCount > 0) {
    return { steps: rawSteps, stepCount: structuredCount };
  }

  const normalized = normalizeUnstructuredSteps(rawSteps);
  return {
    steps: normalized,
    stepCount: countStructuredSteps(normalized),
  };
}

export const createSetuPlanTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Create execution plan in .setu/PLAN.md. Requires RESEARCH.md to exist. Resets step progress to 0.',
  args: {
    objective: tool.schema.string().describe('One sentence: what this plan accomplishes'),
    contextSummary: tool.schema.string().describe('2-3 sentences from RESEARCH.md for subagent context'),
    steps: tool.schema.string().describe('Full step definitions using the atomic format (see PLAN_TEMPLATE)'),
    successCriteria: tool.schema.string().describe('Truths, artifacts, and key links that prove completion')
  },
  async execute(args, context) {
    const projectDir = getProjectDir();

    // Validate projectDir to prevent directory traversal
    try {
      validateProjectDir(projectDir);
    } catch (error) {
      throw new Error(`Invalid project directory: ${getErrorMessage(error)}`);
    }

    // Validate required fields
    if (!args.objective?.trim()) {
      throw new Error('objective is required and cannot be empty');
    }

    if (!args.steps?.trim()) {
      throw new Error('steps is required and cannot be empty');
    }

    // Validate step count to prevent DoS (max 100 steps) and normalize unstructured plans
    const normalizedStepsResult = normalizeStepsInput(args.steps);
    const stepCount = normalizedStepsResult.stepCount;
    if (stepCount > 100) {
      throw new Error(`Too many steps (${stepCount}). Maximum is 100.`);
    }

    // Check precondition: RESEARCH.md must exist
    if (!existsSync(join(projectDir, '.setu', 'RESEARCH.md'))) {
      throw new Error('RESEARCH.md required before creating PLAN.md. Run setu_research first.');
    }

    // Sanitize inputs before persisting (content may be injected into prompts later)
    // Validate null/undefined at API boundaries per guidelines
    const sanitizedArgs = {
      objective: sanitizeObjective(args.objective),
      contextSummary: sanitizeContextSummary(args.contextSummary ?? ''),
      steps: sanitizeSteps(normalizedStepsResult.steps), // Steps can be longer
      successCriteria: sanitizeSuccessCriteria(args.successCriteria ?? '')
    };
    
    // Format the plan using template structure
    const content = formatPlan(sanitizedArgs);
    
    // Ensure .setu/ directory exists (defensive - may have been deleted since RESEARCH.md check)
    ensureSetuDir(projectDir);
    
    // Write PLAN.md
    try {
      await writeFile(join(projectDir, '.setu', 'PLAN.md'), content);
    } catch (error) {
      throw new Error(`Failed to save plan: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }
    
    // CRITICAL: Reset progress to step 0 — new plan means fresh start
    resetProgress(projectDir);
    
    let resultsCleared = true;
    // Clear old results for fresh start (best-effort, non-critical)
    try {
      clearResults(projectDir);
    } catch (error) {
      // Log but don't fail — stale results won't break execution
      debugLog(`Failed to clear old results: ${getErrorMessage(error)}`);
      resultsCleared = false;
    }
    
    // Trigger user approval before execution begins
    if (context?.sessionID) {
      setQuestionBlocked(
        context.sessionID,
        `Plan created with ${stepCount} steps. Ask the user to review and approve the plan before executing.`
      );
    }

    // SECURITY: Log gear transition (architect → builder unlocks write operations)
    debugLog(`[AUDIT] Gear transition: architect → builder. Plan created with ${stepCount} steps. Project: ${projectDir}`);
    
    return `Plan created with ${stepCount} steps. Gear shifted: architect → builder. Progress reset to Step 0. ${resultsCleared ? 'Old results cleared.' : 'Warning: failed to clear old results.'}\n\n**Action required**: Ask the user to confirm this plan before executing.`;
  }
});

/**
 * Format plan content from args
 */
function formatPlan(args: {
  objective: string;
  contextSummary: string;
  steps: string;
  successCriteria: string;
}): string {
  return `# Plan

## Objective

${args.objective}

## Context Summary

${args.contextSummary}

## Steps

${args.steps}

## Success Criteria

${args.successCriteria}
`;
}
