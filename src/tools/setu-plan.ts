import { tool } from '@opencode-ai/plugin';
import { validateProjectDir } from '../utils/path-validation';
import { join } from 'path';
import { writeFile, readFile } from 'fs/promises';
import { decidePlanArtifactMode } from '../context';
import { loadActiveTask, resetProgress } from '../context/active';
import { ensureSetuDir } from '../context/storage';
import { clearResults } from '../context/results';
import { getErrorMessage } from '../utils/error-handling';
import { createPromptMultilineSanitizer, createPromptSanitizer } from '../utils/sanitization';
import { debugLog } from '../debug';

// PLAN_TEMPLATE is embedded to ensure it's available at runtime
export const PLAN_TEMPLATE = `# Plan Template

## Objective
[One sentence: what this plan accomplishes]

## Context Summary
[2-3 sentences from RESEARCH.md for subagent context]

## Non-goals
[What is intentionally out of scope]

## Assumptions / Constraints
[Assumptions and constraints: stack, runtime, env]

## File-level Edit List
- [file path 1]
- [file path 2]

## Steps
# Phase 1: [Phase Name]
## Task 1.1: [Task Name]
- Step 1: [Atomic action]
  - Why: [Justification]
  - Edit(s): [Files]
  - Commands: [Commands]

## Task 1.2: [Next Task]
- Step 1: [Action]
  - Why: [Reason]
  - Edit(s): [Files]
  - Commands: [Commands]

## Expected Output
[What success looks like]

## Rollback Note
[How to revert]

## Acceptance Tests
- [Test 1]
- [Test 2]

## Verify Protocol
build -> lint -> test

## Success Criteria
Plan is complete only if expected output, acceptance tests, and verify protocol pass.
`;

const sanitizeObjective = createPromptSanitizer(500);
const sanitizeContextSummary = createPromptMultilineSanitizer(1000);
const sanitizeSteps = createPromptMultilineSanitizer(10000);
const sanitizeSection = createPromptMultilineSanitizer(2000);

function countSteps(steps: string): number {
  return steps.match(/^-\s+Step\s+\d+:/gim)?.length ?? 0;
}

export const createSetuPlanTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Create execution plan in .setu/PLAN.md. Requires RESEARCH.md.',
  args: {
    objective: tool.schema.string().describe('One sentence: what this plan accomplishes'),
    contextSummary: tool.schema.string().describe('2-3 sentences from RESEARCH.md'),
    nonGoals: tool.schema.string().describe('What is out of scope'),
    assumptions: tool.schema.string().describe('Stack, runtime, constraints'),
    fileEdits: tool.schema.string().describe('Files to modify'),
    steps: tool.schema.string().describe('Phase > Task > Step with Why/Edit(s)/Commands. See PLAN_TEMPLATE.md'),
    expectedOutput: tool.schema.string().describe('What success looks like'),
    rollbackNote: tool.schema.string().describe('How to revert'),
    acceptanceTests: tool.schema.string().describe('Bullet list of tests'),
    verifyProtocol: tool.schema.string().optional().describe('Defaults to build -> lint -> test')
  },
  async execute(args) {
    const projectDir = getProjectDir();

    try {
      validateProjectDir(projectDir);
    } catch (error) {
      throw new Error(`Invalid project directory: ${getErrorMessage(error)}`);
    }

    if (!args.objective?.trim()) throw new Error('objective is required');
    if (!args.steps?.trim()) throw new Error('steps is required');

    // Async check for RESEARCH.md existence
    let hasResearch = false;
    try {
      await readFile(join(projectDir, '.setu', 'RESEARCH.md'), 'utf-8');
      hasResearch = true;
    } catch (error) {
      // Only ENOENT means "file not found" - other errors (EACCES, EMFILE, etc.) should be rethrown
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        hasResearch = false;
      } else {
        // Rethrow non-ENOENT errors with original context
        throw new Error(`Failed to check RESEARCH.md: ${getErrorMessage(error)}`);
      }
    }
    if (!hasResearch) {
      throw new Error('RESEARCH.md required. Run setu_research first.');
    }

    const stepCount = countSteps(args.steps);
    if (stepCount > 100) throw new Error(`Too many steps (${stepCount}). Max is 100.`);

    const sanitized = {
      objective: sanitizeObjective(args.objective),
      contextSummary: sanitizeContextSummary(args.contextSummary ?? ''),
      nonGoals: sanitizeSection(args.nonGoals ?? ''),
      assumptions: sanitizeSection(args.assumptions ?? ''),
      fileEdits: sanitizeSection(args.fileEdits ?? ''),
      steps: sanitizeSteps(args.steps),
      expectedOutput: sanitizeSection(args.expectedOutput ?? ''),
      rollbackNote: sanitizeSection(args.rollbackNote ?? ''),
      acceptanceTests: sanitizeSection(args.acceptanceTests ?? ''),
      verifyProtocol: sanitizeSection(args.verifyProtocol ?? 'build -> lint -> test')
    };

    const planPath = join(projectDir, '.setu', 'PLAN.md');
    // Async read for existing plan
    let existingPlan = '';
    try {
      existingPlan = await readFile(planPath, 'utf-8');
    } catch {
      existingPlan = '';
    }
    const planMode = decidePlanArtifactMode({
      hasExistingPlan: existingPlan.length > 0,
      existingPlanContent: existingPlan,
      activeTask: loadActiveTask(projectDir),
      objective: sanitized.objective,
      fileEdits: sanitized.fileEdits,
    });

    const content = planMode === 'append' && existingPlan
      ? `${existingPlan.trimEnd()}\n\n## Revisions (${new Date().toISOString()})\n\n${formatPlan(sanitized, true)}`
      : formatPlan(sanitized);
    
    ensureSetuDir(projectDir);
    
    try {
      await writeFile(planPath, content);
    } catch (error) {
      throw new Error(`Failed to save plan: ${getErrorMessage(error)}`);
    }
    
    if (planMode === 'remake') {
      resetProgress(projectDir);
      try {
        clearResults(projectDir);
      } catch (e) {
        debugLog(`clearResults failed for projectDir=${projectDir}:`, e);
      }
    }

    debugLog(`[AUDIT] Plan ${planMode === 'append' ? 'revised' : 'created'}. Steps: ${stepCount}. Project: ${projectDir}`);
    
    const fileCount = sanitized.fileEdits.split('\n').filter(l => l.trim().startsWith('-')).length;
    const filePreview = sanitized.fileEdits.split('\n').slice(0, 3).map(l => l.replace(/^-\s*/, '').trim()).join(', ');
    const filesText = fileCount > 3 ? `${filePreview}... (+${fileCount - 3} more)` : filePreview;
    const stepPreview = sanitized.steps.split('\n').filter(l => l.trim().startsWith('- Step')).slice(0, 3).map(l => l.replace(/^-\s+Step\s+\d+:\s*/, '')).join('; ');
    
    return `Plan ${planMode === 'append' ? 'revised' : 'created'} (${stepCount} steps).

**Ready to execute**: ${sanitized.objective}
**Files**: ${filesText || 'No files listed'}

**Plan preview**: ${stepPreview || 'See PLAN.md for full details'}

Reply "go" to start, or tell me what to adjust.`;
  }
});

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
}, isRevision = false): string {
  const h = isRevision ? '###' : '##';
  
  if (isRevision) {
    return `${h} Objective Update
${args.objective}

${h} Context Update
${args.contextSummary}

${h} Non-goals
${args.nonGoals}

${h} Assumptions / Constraints
${args.assumptions}

${h} File-level Edit List
${args.fileEdits}

${h} Steps
${args.steps}

${h} Expected Output
${args.expectedOutput}

${h} Rollback Note
${args.rollbackNote}

${h} Acceptance Tests
${args.acceptanceTests}

${h} Verify Protocol
${args.verifyProtocol}
`;
  }

  return `# Plan

${h} Objective
${args.objective}

${h} Context Summary
${args.contextSummary}

${h} Non-goals
${args.nonGoals}

${h} Assumptions / Constraints
${args.assumptions}

${h} File-level Edit List
${args.fileEdits}

${h} Steps
${args.steps}

${h} Expected Output
${args.expectedOutput}

${h} Rollback Note
${args.rollbackNote}

${h} Acceptance Tests
${args.acceptanceTests}

${h} Verify Protocol
${args.verifyProtocol}

${h} Success Criteria
Plan is complete only if expected output, acceptance tests, and verify protocol pass.
`;
}
