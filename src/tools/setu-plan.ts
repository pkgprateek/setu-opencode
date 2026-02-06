import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
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

export const createSetuPlanTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Create execution plan in .setu/PLAN.md. Requires RESEARCH.md to exist. Resets step progress to 0.',
  args: {
    objective: tool.schema.string().describe('One sentence: what this plan accomplishes'),
    contextSummary: tool.schema.string().describe('2-3 sentences from RESEARCH.md for subagent context'),
    steps: tool.schema.string().describe('Full step definitions using the atomic format (see PLAN_TEMPLATE)'),
    successCriteria: tool.schema.string().describe('Truths, artifacts, and key links that prove completion')
  },
  async execute(args, _context) {
    const projectDir = getProjectDir();

    // Validate required fields
    if (!args.objective?.trim()) {
      throw new Error('objective is required and cannot be empty');
    }

    if (!args.steps?.trim()) {
      throw new Error('steps is required and cannot be empty');
    }

    // Validate step count to prevent DoS (max 100 steps)
    const stepCount = (args.steps.match(/## Step \d+|### Step \d+|\*\*Step \d+\*\*/gi) || []).length;
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
      steps: sanitizeSteps(args.steps), // Steps can be longer
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
    
    // Clear old results for fresh start (best-effort, non-critical)
    try {
      clearResults(projectDir);
    } catch (error) {
      // Log but don't fail — stale results won't break execution
      debugLog(`Failed to clear old results: ${getErrorMessage(error)}`);
    }
    
    return `Plan created with ${countSteps(content)} steps. Gear shifted: architect → builder. Progress reset to Step 0. Old results cleared. Ready for execution.`;
  }
});

/**
 * Count steps in plan content (simple regex, doesn't need to be perfect)
 */
function countSteps(content: string): number {
  const stepMatches = content.match(/## Step \d+|### Step \d+|\*\*Step \d+\*\*/gi);
  return stepMatches?.length ?? 0;
}

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
