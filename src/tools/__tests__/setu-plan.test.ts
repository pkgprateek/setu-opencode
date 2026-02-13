import { describe, expect, test } from 'bun:test';
import { countStructuredSteps, normalizeStepsInput, validatePlanContract } from '../setu-plan';

describe('setu_plan step parsing', () => {
  test('counts heading-based steps', () => {
    const steps = '## Step 1: Do A\n\n## Step 2: Do B';
    expect(countStructuredSteps(steps)).toBe(2);
  });

  test('counts numbered list steps', () => {
    const steps = '1. Do A\n2. Do B\n3. Do C';
    expect(countStructuredSteps(steps)).toBe(3);
  });

  test('counts bullet list steps', () => {
    const steps = '- Do A\n- Do B';
    expect(countStructuredSteps(steps)).toBe(2);
  });

  test('normalizes unstructured steps into executable format', () => {
    const result = normalizeStepsInput('Create file and verify it works.');
    expect(result.stepCount).toBeGreaterThanOrEqual(2);
    expect(result.steps).toContain('## Step 1');
    expect(result.steps).toContain('## Step 2');
  });
});

describe('setu_plan contract validation', () => {
  test('accepts a valid contract-compliant plan', () => {
    const errors = validatePlanContract({
      objective: 'Add JWT rotation support',
      nonGoals: 'No auth provider migration',
      assumptions: 'Node 20, Bun runtime, existing auth middleware',
      fileEdits: '- src/auth/middleware.ts\n- src/auth/types.ts',
      steps: [
        'S01',
        'Why: support rotating signing keys',
        'Edit(s): src/auth/middleware.ts update token verification',
        'Commands: bun test src/auth',
        'S02',
        'Why: ensure type safety for key metadata',
        'Edit(s): src/auth/types.ts add keyset fields',
        'Commands: bun run typecheck',
      ].join('\n'),
      expectedOutput: 'Tokens signed with active key validate while rotated keys remain accepted',
      rollbackNote: 'Revert middleware and keyset type changes',
      acceptanceTests: '- rotates keys without auth outage\n- invalid key rejects with 401',
      verifyProtocol: 'build -> lint -> test',
    });

    expect(errors).toEqual([]);
  });

  test('reports missing required sections and malformed steps', () => {
    const errors = validatePlanContract({
      objective: 'Do thing',
      nonGoals: '',
      assumptions: '',
      fileEdits: '',
      steps: 'S01\nEdit(s): src/a.ts\nCommands: bun test',
      expectedOutput: '',
      rollbackNote: '',
      acceptanceTests: '',
      verifyProtocol: 'build -> test',
    });

    expect(errors).toContain('Non-goals is required');
    expect(errors).toContain('Assumptions / constraints is required');
    expect(errors).toContain('File-level edit list is required');
    expect(errors).toContain('Expected output is required');
    expect(errors).toContain('Rollback note is required');
    expect(errors).toContain('Acceptance tests is required');
  });

  test('requires per-step Why/Edit(s)/Commands fields', () => {
    const errors = validatePlanContract({
      objective: 'Do thing',
      nonGoals: 'N/A',
      assumptions: 'N/A',
      fileEdits: '- src/a.ts',
      steps: 'S01\nWhy: x\nEdit(s): src/a.ts\nS02\nWhy: y\nCommands: bun test',
      expectedOutput: 'Works',
      rollbackNote: 'git checkout -- src/a.ts',
      acceptanceTests: '- test passes',
      verifyProtocol: 'build -> lint -> test',
    });

    expect(errors).toContain('S01 is missing "Commands:"');
    expect(errors).toContain('S02 is missing "Edit(s):"');
  });
});
