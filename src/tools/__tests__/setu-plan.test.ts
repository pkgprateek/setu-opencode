import { describe, expect, test } from 'bun:test';
import { countStructuredSteps, normalizeStepsInput } from '../setu-plan';

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
