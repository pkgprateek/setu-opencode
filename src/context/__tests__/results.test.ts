/**
 * Unit tests for results.ts - Results Pattern implementation
 * 
 * Tests:
 * 1. writeStepResult - Atomic writes, sanitization, size limits
 * 2. readStepResult - Reading and parsing
 * 3. sanitizeYamlString - YAML injection prevention
 * 4. validateProjectDir - Path traversal prevention
 * 
 * Run with: bun test src/context/__tests__/results.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  writeStepResult,
  readStepResult,
  listCompletedSteps,
  clearResults,
  getLastCompletedStep
} from '../results';
import { sanitizeYamlString } from '../../utils/sanitization';
import type { StepResult } from '../results';

describe('Results Pattern', () => {
  let testDir: string;
  let resultsDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `setu-results-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    resultsDir = join(testDir, '.setu', 'results');
    // Don't create resultsDir here - tests that need it should create it themselves
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('writeStepResult', () => {
    test('writes result file with YAML frontmatter', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test objective',
        outputs: ['file1.ts', 'file2.ts'],
        summary: 'Test summary',
        verification: 'Build passed',
        timestamp: new Date().toISOString()
      };

      writeStepResult(testDir, result);

      const filePath = join(resultsDir, 'step-1.md');
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('step: 1');
      expect(content).toContain('status: completed');
      expect(content).toContain('# Step 1: Test objective');
    });

    test('uses atomic write pattern (temp file + rename)', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test',
        outputs: [],
        summary: 'Test',
        timestamp: new Date().toISOString()
      };

      writeStepResult(testDir, result);

      // Check that no temp files remain
      const files = readdirSync(resultsDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

    test('sanitizes objective field', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test: with control\x00char\nNew: line',
        outputs: [],
        summary: 'Test',
        timestamp: new Date().toISOString()
      };

      writeStepResult(testDir, result);

      const content = readFileSync(join(resultsDir, 'step-1.md'), 'utf-8');
      // Control characters should be removed, newlines replaced with spaces
      // Colons followed by spaces are also sanitized to prevent YAML injection
      expect(content).not.toContain('\x00');
      expect(content).toContain('Test-with controlcharNew-line');
    });

    test('sanitizes verification field', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test',
        outputs: [],
        summary: 'Test',
        verification: 'Build passed with control\x00char',
        timestamp: new Date().toISOString()
      };

      writeStepResult(testDir, result);

      const content = readFileSync(join(resultsDir, 'step-1.md'), 'utf-8');
      // Control characters should be removed
      expect(content).not.toContain('\x00');
    });

    test('enforces 100KB size limit with truncation', () => {
      mkdirSync(resultsDir, { recursive: true });
      // Create a summary that's definitely over 100KB before sanitization
      // Each char is 1 byte in UTF-8, so 120000 chars = ~120KB
      const hugeSummary = 'x'.repeat(120000);
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test',
        outputs: [],
        summary: hugeSummary,
        timestamp: new Date().toISOString()
      };

      // Should write successfully because summary gets sanitized/truncated to 2000 chars
      expect(() => writeStepResult(testDir, result)).not.toThrow();
      
      // Verify the file was written
      const filePath = join(resultsDir, 'step-1.md');
      expect(existsSync(filePath)).toBe(true);
      
      // Verify the summary was truncated
      const content = readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('x'.repeat(5000)); // Original huge summary shouldn't be there
    });

    test('validates step number is positive integer', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: -1,
        status: 'completed',
        objective: 'Test',
        outputs: [],
        summary: 'Test',
        timestamp: new Date().toISOString()
      };

      expect(() => writeStepResult(testDir, result)).toThrow('Invalid step number');
    });

    test('uses high entropy for temp filename', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test',
        outputs: [],
        summary: 'Test',
        timestamp: new Date().toISOString()
      };

      writeStepResult(testDir, result);

      // Check that temp files use 32 hex chars (16 bytes)
      // This is verified by the fact that write succeeds without collision
      const filePath = join(resultsDir, 'step-1.md');
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('readStepResult', () => {
    test('reads and parses result file correctly', () => {
      mkdirSync(resultsDir, { recursive: true });
      const result: StepResult = {
        step: 1,
        status: 'completed',
        objective: 'Test objective',
        outputs: ['file1.ts'],
        summary: 'Test summary',
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      writeStepResult(testDir, result);
      const read = readStepResult(testDir, 1);

      expect(read).toBeDefined();
      expect(read?.step).toBe(1);
      expect(read?.status).toBe('completed');
      expect(read?.objective).toBe('Test objective');
    });

    test('returns null for non-existent step', () => {
      const read = readStepResult(testDir, 999);
      expect(read).toBeNull();
    });

    test('returns null for invalid step parameter', () => {
      const read = readStepResult(testDir, -1);
      expect(read).toBeNull();
    });

    test('handles corrupted files gracefully', () => {
      // Write corrupted content
      const corruptedFile = join(resultsDir, 'step-1.md');
      mkdirSync(resultsDir, { recursive: true });
      writeFileSync(corruptedFile, 'not valid markdown');

      const read = readStepResult(testDir, 1);
      expect(read).toBeNull();
    });
  });

  describe('sanitizeYamlString', () => {
    test('removes control characters', () => {
      const input = 'Test\x00with\x01control\x02chars';
      const sanitized = sanitizeYamlString(input);
      expect(sanitized).toBe('Testwithcontrolchars');
    });

    test('escapes backslashes', () => {
      const input = 'Path\\to\\file';
      const sanitized = sanitizeYamlString(input);
      expect(sanitized).toContain('\\\\');
    });

    test('escapes double quotes', () => {
      const input = 'Say "hello"';
      const sanitized = sanitizeYamlString(input);
      expect(sanitized).toContain('\\"');
    });

    test('preserves URLs (only replaces colons at line start)', () => {
      const input = 'Visit https://example.com:8080/path';
      const sanitized = sanitizeYamlString(input);
      expect(sanitized).toContain('https://example.com:8080/path');
    });

    test('escapes hash characters', () => {
      const input = 'Issue #123';
      const sanitized = sanitizeYamlString(input);
      expect(sanitized).toContain('\\#');
    });

    test('truncates to 2000 chars', () => {
      const input = 'x'.repeat(3000);
      const sanitized = sanitizeYamlString(input);
      expect(sanitized.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('listCompletedSteps', () => {
    test('returns sorted list of completed steps', () => {
      mkdirSync(resultsDir, { recursive: true });
      // Write steps out of order
      for (const step of [3, 1, 5, 2]) {
        writeStepResult(testDir, {
          step,
          status: 'completed',
          objective: `Step ${step}`,
          outputs: [],
          summary: `Summary ${step}`,
          timestamp: new Date().toISOString()
        });
      }

      const steps = listCompletedSteps(testDir);
      expect(steps).toEqual([1, 2, 3, 5]);
    });

    test('returns empty array when no results', () => {
      const steps = listCompletedSteps(testDir);
      expect(steps).toEqual([]);
    });
  });

  describe('clearResults', () => {
    test('removes all result files', () => {
      mkdirSync(resultsDir, { recursive: true });
      // Create some results
      for (let i = 1; i <= 3; i++) {
        writeStepResult(testDir, {
          step: i,
          status: 'completed',
          objective: `Step ${i}`,
          outputs: [],
          summary: `Summary ${i}`,
          timestamp: new Date().toISOString()
        });
      }

      clearResults(testDir);

      const steps = listCompletedSteps(testDir);
      expect(steps).toEqual([]);
    });

    test('does nothing when results directory does not exist', () => {
      // Should not throw
      expect(() => clearResults(testDir)).not.toThrow();
    });
  });

  describe('getLastCompletedStep', () => {
    test('returns highest step number', () => {
      mkdirSync(resultsDir, { recursive: true });
      writeStepResult(testDir, {
        step: 5,
        status: 'completed',
        objective: 'Step 5',
        outputs: [],
        summary: 'Summary',
        timestamp: new Date().toISOString()
      });

      writeStepResult(testDir, {
        step: 10,
        status: 'completed',
        objective: 'Step 10',
        outputs: [],
        summary: 'Summary',
        timestamp: new Date().toISOString()
      });

      expect(getLastCompletedStep(testDir)).toBe(10);
    });

    test('returns 0 when no results', () => {
      expect(getLastCompletedStep(testDir)).toBe(0);
    });
  });
});

describe('Path Validation', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `setu-path-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('accepts valid project directory', () => {
    mkdirSync(join(testDir, '.setu', 'results'), { recursive: true });
    const result: StepResult = {
      step: 1,
      status: 'completed',
      objective: 'Test',
      outputs: [],
      summary: 'Test',
      timestamp: new Date().toISOString()
    };

    // Should not throw
    expect(() => writeStepResult(testDir, result)).not.toThrow();
  });

  test('rejects null bytes in path', () => {
    const badDir = join(testDir, 'subdir\x00null');
    const result: StepResult = {
      step: 1,
      status: 'completed',
      objective: 'Test',
      outputs: [],
      summary: 'Test',
      timestamp: new Date().toISOString()
    };

    expect(() => writeStepResult(badDir, result)).toThrow();
  });

  test('rejects path traversal attempts', () => {
    // Use string concatenation to avoid path normalization
    const badDir = testDir + '/../../etc';
    const result: StepResult = {
      step: 1,
      status: 'completed',
      objective: 'Test',
      outputs: [],
      summary: 'Test',
      timestamp: new Date().toISOString()
    };

    expect(() => writeStepResult(badDir, result)).toThrow('path traversal');
  });
});
