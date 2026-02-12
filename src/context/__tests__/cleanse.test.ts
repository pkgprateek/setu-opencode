/**
 * Unit tests for cleanse.ts - JIT Context preparation
 * 
 * Tests:
 * 1. prepareJITContext - Context generation with sanitization
 * 2. getJITContextSummary - Summary generation
 * 3. validateProjectDir - Path validation
 * 4. sanitizeObjective - Input sanitization
 * 
 * Run with: bun test src/context/__tests__/cleanse.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { prepareJITContext, getJITContextSummary } from '../cleanse';
import { saveActiveTask, createActiveTask } from '../active';
import { writeStepResult } from '../results';
import type { StepResult } from '../results';

describe('JIT Context Preparation', () => {
  let testDir: string;
  let setuDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `setu-cleanse-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setuDir = join(testDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('prepareJITContext', () => {
    test('generates context with correct step number', () => {
      const task = createActiveTask('Test task');
      task.progress = { lastCompletedStep: 3, lastCompletedAt: new Date().toISOString() };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('Step 4');
      expect(context).toContain('Last completed: Step 3');
    });

    test('includes objective in context', () => {
      const task = createActiveTask('Test task');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Implement feature X', { mode: 'full' });

      expect(context).toContain('Implement feature X');
    });

    test('includes failed approaches (last 3 only)', () => {
      const task = createActiveTask('Test task');
      task.learnings = {
        worked: [],
        failed: [
          'Approach 1 failed',
          'Approach 2 failed',
          'Approach 3 failed',
          'Approach 4 failed',
          'Approach 5 failed'
        ]
      };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      // Should only include last 3
      expect(context).toContain('Approach 3 failed');
      expect(context).toContain('Approach 4 failed');
      expect(context).toContain('Approach 5 failed');
      expect(context).not.toContain('Approach 1 failed');
      expect(context).not.toContain('Approach 2 failed');
    });

    test('truncates failed approaches to 200 chars', () => {
      const longApproach = 'x'.repeat(500);
      const task = createActiveTask('Test task');
      task.learnings = {
        worked: [],
        failed: [longApproach]
      };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      // Verify "## Failed Approaches" section exists
      expect(context).toContain('## Failed Approaches');

      // Extract the failed approaches section - handle various newline patterns
      const failedSectionMatch = context.match(/## Failed Approaches[\s\S]*?(?=\n## |---|$)/);
      expect(failedSectionMatch).not.toBeNull();

      const failedSection = failedSectionMatch![0];
      // Extract the actual failed approach text (should be a list item)
      const approachMatch = failedSection.match(/- ([^\n]+)/);
      expect(approachMatch).not.toBeNull();

      const approachText = approachMatch![1];
      // Should be truncated to 200 chars (plus any markdown formatting)
      expect(approachText.length).toBeLessThanOrEqual(210); // Allow small buffer for formatting
      expect(approachText).toContain('x'.repeat(50)); // Should contain start of original
      expect(approachText.length).toBeLessThan(longApproach.length); // Should be shorter than original
    });

    test('includes constraints from active task', () => {
      const task = createActiveTask('Test task');
      task.constraints = ['READ_ONLY', 'NO_PUSH'];
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('READ_ONLY');
      expect(context).toContain('NO_PUSH');
    });

    test('includes previous step summary if available', () => {
      // Create task at step 1
      const task = createActiveTask('Test task');
      task.progress = { lastCompletedStep: 1, lastCompletedAt: new Date().toISOString() };
      saveActiveTask(testDir, task);

      // Write step 1 result
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Step 1 objective',
        outputs: [],
        summary: 'Step 1 was completed successfully with all tests passing',
        timestamp: new Date().toISOString()
      };
      writeStepResult(testDir, result);

      const context = prepareJITContext(testDir, 'Do step 2', { mode: 'full' });

      expect(context).toContain('Previous Step (1) Summary');
      expect(context).toContain('Step 1 was completed successfully');
    });

    test('sanitizes objective (removes control chars)', () => {
      const task = createActiveTask('Test task');
      saveActiveTask(testDir, task);

      const maliciousObjective = 'Do something\x00with\x01control\x02chars';
      const context = prepareJITContext(testDir, maliciousObjective, { mode: 'full' });

      expect(context).not.toContain('\x00');
      expect(context).not.toContain('\x01');
      expect(context).not.toContain('\x02');
    });

    test('returns recovery mode on path traversal attempt', () => {
      // Use path with traversal attempt which will fail validation
      const badDir = testDir + '/../../etc';

      // Should return recovery mode for invalid paths (Issue 1: consistent error handling)
      const context = prepareJITContext(badDir, 'Do something', { mode: 'full' });
      expect(context).toContain('[SETU: JIT Context - Recovery Mode]');
      expect(context).toContain('Do something');
    });

    test('truncates context if over maxTokens', () => {
      const task = createActiveTask('Test task');
      task.learnings = {
        worked: [],
        failed: ['x'.repeat(10000)]
      };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { 
        mode: 'full', 
        maxTokens: 100 // Small limit to force truncation
      });

      expect(context).toContain('[TRUNCATED]');
    });

    test('uses nullish coalescing for maxTokens (handles 0)', () => {
      const task = createActiveTask('Test task');
      saveActiveTask(testDir, task);

      // maxTokens: 0 should use default (2000), not 0
      // This means the context should be generated normally, not truncated immediately
      const context = prepareJITContext(testDir, 'Small objective', { 
        mode: 'full', 
        maxTokens: 0 
      });

      // Should contain the full context structure (not empty or just truncated)
      expect(context).toContain('JIT Context');
      expect(context).toContain('Your Objective');
      expect(context).toContain('Small objective');
    });

    test('includes artifacts section', () => {
      const task = createActiveTask('Test task');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('.setu/PLAN.md');
      expect(context).toContain('.setu/RESEARCH.md');
      expect(context).toContain('.setu/results/step-{N}.md');
    });

    test('includes execution instructions', () => {
      const task = createActiveTask('Test task');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('Read .setu/PLAN.md');
      expect(context).toContain('Find Step');
      expect(context).toContain('Call setu_verify when complete');
    });
  });

  describe('getJITContextSummary', () => {
    test('returns summary with correct step number', () => {
      const task = createActiveTask('Test task');
      task.progress = { lastCompletedStep: 5, lastCompletedAt: new Date().toISOString() };
      saveActiveTask(testDir, task);

      const summary = getJITContextSummary(testDir);

      expect(summary.step).toBe(6);
      expect(summary.objective).toBe('Test task');
    });

    test('returns safe defaults when no active task', () => {
      // Don't create any active task
      const summary = getJITContextSummary(testDir);

      expect(summary.step).toBe(1);
      expect(summary.objective).toBe('Unknown');
      expect(summary.failedApproaches).toEqual([]);
      expect(summary.constraints).toEqual([]);
    });

    test('returns safe default on path traversal attempt', () => {
      // Use string concatenation to avoid path normalization
      const badDir = testDir + '/../../etc';
      
      // Should return safe default for invalid paths (Issue 1: consistent error handling)
      const summary = getJITContextSummary(badDir);
      expect(summary.step).toBe(1);
      expect(summary.objective).toBe('Unknown (context unavailable)');
      expect(summary.failedApproaches).toEqual([]);
      expect(summary.constraints).toEqual([]);
    });

    test('includes failed approaches (last 3)', () => {
      const task = createActiveTask('Test task');
      task.learnings = {
        worked: [],
        failed: ['Fail 1', 'Fail 2', 'Fail 3', 'Fail 4']
      };
      saveActiveTask(testDir, task);

      const summary = getJITContextSummary(testDir);

      expect(summary.failedApproaches).toHaveLength(3);
      expect(summary.failedApproaches).toContain('Fail 2');
      expect(summary.failedApproaches).toContain('Fail 3');
      expect(summary.failedApproaches).toContain('Fail 4');
    });

    test('includes constraints', () => {
      const task = createActiveTask('Test task');
      task.constraints = ['READ_ONLY', 'NO_PUSH'];
      saveActiveTask(testDir, task);

      const summary = getJITContextSummary(testDir);

      expect(summary.constraints).toEqual(['READ_ONLY', 'NO_PUSH']);
    });
  });
});
