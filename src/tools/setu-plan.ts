import { tool } from '@opencode-ai/plugin';
import { validateProjectDir } from '../utils/path-validation';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { decidePlanArtifactMode, setQuestionBlocked } from '../context';
import { loadActiveTask, resetProgress } from '../context/active';
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
const sanitizeSection = createPromptSanitizer(2000);
const sanitizeVerifyProtocol = createPromptSanitizer(200);

const STEP_ID_PATTERN = /\bS\d{2,}\b/g;

export interface PlanContractInput {
  objective: string;
  nonGoals: string;
  assumptions: string;
  fileEdits: string;
  steps: string;
  expectedOutput: string;
  rollbackNote: string;
  acceptanceTests: string;
  verifyProtocol: string;
}

export function validatePlanContract(input: PlanContractInput): string[] {
  const errors: string[] = [];

  const requireNonEmpty = (label: string, value: string): void => {
    if (!value || !value.trim()) {
      errors.push(`${label} is required`);
    }
  };

  requireNonEmpty('Goal (objective)', input.objective);
  requireNonEmpty('Non-goals', input.nonGoals);
  requireNonEmpty('Assumptions / constraints', input.assumptions);
  requireNonEmpty('File-level edit list', input.fileEdits);
  requireNonEmpty('Step list', input.steps);
  requireNonEmpty('Expected output', input.expectedOutput);
  requireNonEmpty('Rollback note', input.rollbackNote);
  requireNonEmpty('Acceptance tests', input.acceptanceTests);
  requireNonEmpty('Verify protocol', input.verifyProtocol);

  if (errors.length > 0) {
    return errors;
  }

  const stepIdMatches = input.steps.match(STEP_ID_PATTERN) ?? [];
  if (stepIdMatches.length === 0) {
    errors.push('Step list must include Step IDs (S01, S02, ...)');
  }

  const canonicalProtocol = input.verifyProtocol.toLowerCase().replace(/\s+/g, '');
  if (!(canonicalProtocol.includes('build') && canonicalProtocol.includes('lint') && canonicalProtocol.includes('test'))) {
    errors.push('Verify protocol must include build -> lint -> test');
  }

  const perStepChunks = input.steps
    .split(/(?=\bS\d{2,}\b)/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0 && /\bS\d{2,}\b/.test(chunk));

  for (const chunk of perStepChunks) {
    const idMatch = chunk.match(/\b(S\d{2,})\b/);
    const stepId = idMatch?.[1] ?? 'UnknownStep';

    if (!/\bwhy\b\s*:/i.test(chunk)) {
      errors.push(`${stepId} is missing "Why:"`);
    }
    if (!/edit\(s\)\s*:/i.test(chunk)) {
      errors.push(`${stepId} is missing "Edit(s):"`);
    }
    if (!/\bcommands?\b\s*:/i.test(chunk)) {
      errors.push(`${stepId} is missing "Commands:"`);
    }
  }

  return errors;
}

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
    nonGoals: tool.schema.string().describe('What is intentionally out of scope for this plan'),
    assumptions: tool.schema.string().describe('Assumptions and constraints (stack, runtime, env)'),
    fileEdits: tool.schema.string().describe('Exact file-level edit list'),
    steps: tool.schema.string().describe('Full step definitions using the atomic format (see PLAN_TEMPLATE)'),
    expectedOutput: tool.schema.string().describe('What success looks like after execution'),
    rollbackNote: tool.schema.string().describe('How to revert safely if the plan fails'),
    acceptanceTests: tool.schema.string().describe('Bullet list of acceptance tests'),
    verifyProtocol: tool.schema.string().optional().describe('Verification order, defaults to build -> lint -> test')
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

    const planContractErrors = validatePlanContract({
      objective: args.objective,
      nonGoals: args.nonGoals,
      assumptions: args.assumptions,
      fileEdits: args.fileEdits,
      steps: args.steps,
      expectedOutput: args.expectedOutput,
      rollbackNote: args.rollbackNote,
      acceptanceTests: args.acceptanceTests,
      verifyProtocol: args.verifyProtocol ?? 'build -> lint -> test',
    });

    if (planContractErrors.length > 0) {
      throw new Error(`Plan contract validation failed:\n- ${planContractErrors.join('\n- ')}`);
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
      nonGoals: sanitizeSection(args.nonGoals ?? ''),
      assumptions: sanitizeSection(args.assumptions ?? ''),
      fileEdits: sanitizeSection(args.fileEdits ?? ''),
      steps: sanitizeSteps(normalizedStepsResult.steps), // Steps can be longer
      expectedOutput: sanitizeSuccessCriteria(args.expectedOutput ?? ''),
      rollbackNote: sanitizeSection(args.rollbackNote ?? ''),
      acceptanceTests: sanitizeSection(args.acceptanceTests ?? ''),
      verifyProtocol: sanitizeVerifyProtocol(args.verifyProtocol ?? 'build -> lint -> test')
    };
    
    // Format the plan using template structure
    const planPath = join(projectDir, '.setu', 'PLAN.md');
    const existingPlan = existsSync(planPath) ? readFileSync(planPath, 'utf-8') : '';
    const planMode = decidePlanArtifactMode({
      hasExistingPlan: existingPlan.length > 0,
      existingPlanContent: existingPlan,
      activeTask: loadActiveTask(projectDir),
      objective: sanitizedArgs.objective,
      fileEdits: sanitizedArgs.fileEdits,
    });

    const content = planMode === 'append' && existingPlan
      ? `${existingPlan.trimEnd()}\n\n## Revisions (${new Date().toISOString()})\n\n${formatPlanRevision(sanitizedArgs)}`
      : formatPlan(sanitizedArgs);
    
    // Ensure .setu/ directory exists (defensive - may have been deleted since RESEARCH.md check)
    ensureSetuDir(projectDir);
    
    // Write PLAN.md
    try {
      await writeFile(planPath, content);
    } catch (error) {
      throw new Error(`Failed to save plan: ${getErrorMessage(error)}. Check .setu/ directory permissions.`);
    }
    
    if (planMode === 'remake') {
      // CRITICAL: New plan means fresh start
      resetProgress(projectDir);
    }
    
    let resultsCleared = planMode === 'append';
    if (planMode === 'remake') {
      try {
        clearResults(projectDir);
      } catch (error) {
        debugLog(`Failed to clear old results: ${getErrorMessage(error)}`);
        resultsCleared = false;
      }
    }
    
    // Trigger user approval before execution begins
    if (context?.sessionID) {
      setQuestionBlocked(
        context.sessionID,
         `Plan ${planMode === 'append' ? 'revised' : 'created'} with ${stepCount} steps. Ask the user to review and approve before executing.`
       );
    }

    // SECURITY: Log gear transition (architect → builder unlocks write operations)
    debugLog(`[AUDIT] Gear transition: architect -> builder. Plan ${planMode}. Steps: ${stepCount}. Project: ${projectDir}`);
    
    const progressMessage = planMode === 'append' ? 'Progress preserved.' : 'Progress reset to Step 0.';
    const clearMessage = planMode === 'append'
      ? 'Existing results preserved for continuity.'
      : (resultsCleared ? 'Old results cleared.' : 'Warning: failed to clear old results.');

    return `Plan ${planMode === 'append' ? 'revised' : 'created'} with ${stepCount} steps. Gear shifted: architect -> builder. ${progressMessage} ${clearMessage}\n\n**Action required**: Ask the user to confirm this plan before executing.`;
  }
});

/**
 * Format plan content from args
 */
function formatPlan(args: {
  objective: string;
  contextSummary: string;
  nonGoals: string;
  assumptions: string;
  fileEdits: string;
  steps: string;
  expectedOutput: string;
  rollbackNote: string;
  acceptanceTests: string;
  verifyProtocol: string;
}): string {
  return `# Plan

## Objective

${args.objective}

## Context Summary

${args.contextSummary}

## Non-goals

${args.nonGoals}

## Assumptions / Constraints

${args.assumptions}

## File-level Edit List

${args.fileEdits}

## Steps

${args.steps}

## Expected Output

${args.expectedOutput}

## Rollback Note

${args.rollbackNote}

## Acceptance Tests

${args.acceptanceTests}

## Verify Protocol

${args.verifyProtocol}

## Success Criteria

Plan is complete only if expected output, acceptance tests, and verify protocol pass.
`;
}

function formatPlanRevision(args: {
  objective: string;
  contextSummary: string;
  nonGoals: string;
  assumptions: string;
  fileEdits: string;
  steps: string;
  expectedOutput: string;
  rollbackNote: string;
  acceptanceTests: string;
  verifyProtocol: string;
}): string {
  return `### Objective Update

${args.objective}

### Context Update

${args.contextSummary}

### Non-goals

${args.nonGoals}

### Assumptions / Constraints

${args.assumptions}

### File-level Edit List

${args.fileEdits}

### Steps

${args.steps}

### Expected Output

${args.expectedOutput}

### Rollback Note

${args.rollbackNote}

### Acceptance Tests

${args.acceptanceTests}

### Verify Protocol

${args.verifyProtocol}
`;
}
