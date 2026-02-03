import { tool } from '@opencode-ai/plugin';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resetProgress } from '../context/active';
import { sanitizeForPrompt } from '../security/prompt-sanitization';

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
    
    // Check precondition: RESEARCH.md must exist
    if (!existsSync(join(projectDir, '.setu', 'RESEARCH.md'))) {
      throw new Error('RESEARCH.md required before creating PLAN.md. Run setu_research first.');
    }
    
    // Sanitize inputs before persisting (content may be injected into prompts later)
    const sanitizedArgs = {
      objective: sanitizeForPrompt(args.objective, 500),
      contextSummary: sanitizeForPrompt(args.contextSummary, 1000),
      steps: sanitizeForPrompt(args.steps, 10000), // Steps can be longer
      successCriteria: sanitizeForPrompt(args.successCriteria, 2000)
    };
    
    // Format the plan using template structure
    const content = formatPlan(sanitizedArgs);
    
    // Write PLAN.md
    await writeFile(join(projectDir, '.setu', 'PLAN.md'), content);
    
    // CRITICAL: Reset progress to step 0 — new plan means fresh start
    resetProgress(projectDir);
    
    return `Plan created with ${countSteps(content)} steps. Gear shifted: architect → builder. Progress reset to Step 0. Ready for execution.`;
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
