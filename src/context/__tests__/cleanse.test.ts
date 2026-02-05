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
      const task = createActiveTask('Test task', 'ultrathink');
      task.progress = { lastCompletedStep: 3, lastCompletedAt: new Date().toISOString() };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('Step 4');
      expect(context).toContain('Last completed: Step 3');
    });

    test('includes objective in context', () => {
      const task = createActiveTask('Test task', 'ultrathink');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Implement feature X', { mode: 'full' });

      expect(context).toContain('Implement feature X');
    });

    test('includes failed approaches (last 3 only)', () => {
      const task = createActiveTask('Test task', 'ultrathink');
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
      const task = createActiveTask('Test task', 'ultrathink');
      task.learnings = {
        worked: [],
        failed: ['x'.repeat(500)]
      };
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      // Should be truncated in the context (allow some buffer for markdown formatting)
      const failedSection = context.split('## Failed Approaches')[1];
      expect(failedSection?.length).toBeLessThan(400);
    });

    test('includes constraints from active task', () => {
      const task = createActiveTask('Test task', 'ultrathink');
      task.constraints = ['READ_ONLY', 'NO_PUSH'];
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('READ_ONLY');
      expect(context).toContain('NO_PUSH');
    });

    test('includes previous step summary if available', () => {
      // Create task at step 1
      const task = createActiveTask('Test task', 'ultrathink');
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
      const task = createActiveTask('Test task', 'ultrathink');
      saveActiveTask(testDir, task);

      const maliciousObjective = 'Do something\x00with\x01control\x02chars';
      const context = prepareJITContext(testDir, maliciousObjective, { mode: 'full' });

      expect(context).not.toContain('\x00');
      expect(context).not.toContain('\x01');
      expect(context).not.toContain('\x02');
    });

    test('throws on path traversal attempt', () => {
      // Use path with traversal attempt which will fail validation
      const badDir = testDir + '/../../etc';

      // Should throw for invalid paths
      expect(() => prepareJITContext(badDir, 'Do something', { mode: 'full' })).toThrow('path traversal');
    });

    test('truncates context if over maxTokens', () => {
      const task = createActiveTask('Test task', 'ultrathink');
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
      const task = createActiveTask('Test task', 'ultrathink');
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
      const task = createActiveTask('Test task', 'ultrathink');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('.setu/PLAN.md');
      expect(context).toContain('.setu/RESEARCH.md');
      expect(context).toContain('.setu/results/step-{N}.md');
    });

    test('includes execution instructions', () => {
      const task = createActiveTask('Test task', 'ultrathink');
      saveActiveTask(testDir, task);

      const context = prepareJITContext(testDir, 'Do something', { mode: 'full' });

      expect(context).toContain('Read .setu/PLAN.md');
      expect(context).toContain('Find Step');
      expect(context).toContain('Call setu_verify when complete');
    });
  });

  describe('getJITContextSummary', () => {
    test('returns summary with correct step number', () => {
      const task = createActiveTask('Test task', 'ultrathink');
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

    test('throws on path traversal attempt', () => {
      // Use string concatenation to avoid path normalization
      const badDir = testDir + '/../../etc';
      
      // Should throw for invalid paths
      expect(() => getJITContextSummary(badDir)).toThrow('path traversal');
    });

    test('includes failed approaches (last 3)', () => {
      const task = createActiveTask('Test task', 'ultrathink');
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
      const task = createActiveTask('Test task', 'ultrathink');
      task.constraints = ['READ_ONLY', 'NO_PUSH'];
      saveActiveTask(testDir, task);

      const summary = getJITContextSummary(testDir);

      expect(summary.constraints).toEqual(['READ_ONLY', 'NO_PUSH']);
    });
  });
});
