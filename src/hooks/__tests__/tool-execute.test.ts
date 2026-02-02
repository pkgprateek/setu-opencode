/**
 * Unit tests for tool-execute.ts
 * 
 * Tests:
 * 1. Batching: Multiple recordToolExecution calls within window → single log entry
 * 2. Isolation: Session A and B batches are tracked separately
 * 3. Safety: Write events are NOT tracked in parallel batch
 * 
 * Run with: bun test
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  createActiveBatchesMap,
  disposeSessionBatch,
  recordToolExecution,
  createToolExecuteAfterHook,
  type ActiveBatchesMap,
  type VerificationStep
} from '../tool-execute';

// Mock debugLog to prevent console output during tests
mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {}
}));

describe('Parallel Execution Tracking', () => {
  let activeBatches: ActiveBatchesMap;

  beforeEach(() => {
    activeBatches = createActiveBatchesMap();
  });

  afterEach(() => {
    // Clean up any pending timers
    for (const sessionId of activeBatches.keys()) {
      disposeSessionBatch(activeBatches, sessionId);
    }
  });

  test('batches multiple read events within time window', () => {
    const sessionId = 'session-1';
    
    // Fire 3 read events quickly using recordToolExecution directly
    recordToolExecution(activeBatches, sessionId, 'read');
    recordToolExecution(activeBatches, sessionId, 'read');
    recordToolExecution(activeBatches, sessionId, 'glob');

    // Batch should exist with 3 tools
    const batch = activeBatches.get(sessionId);
    expect(batch).toBeDefined();
    expect(batch?.toolNames).toHaveLength(3);
    expect(batch?.toolNames).toEqual(['read', 'read', 'glob']);
  });

  test('tracks sessions independently', () => {
    const sessionA = 'session-a';
    const sessionB = 'session-b';
    
    // Fire events for session A
    recordToolExecution(activeBatches, sessionA, 'read');
    recordToolExecution(activeBatches, sessionA, 'read');

    // Fire events for session B
    recordToolExecution(activeBatches, sessionB, 'glob');

    // Each session should have its own batch
    const batchA = activeBatches.get(sessionA);
    const batchB = activeBatches.get(sessionB);
    
    expect(batchA).toBeDefined();
    expect(batchB).toBeDefined();
    expect(batchA?.toolNames).toEqual(['read', 'read']);
    expect(batchB?.toolNames).toEqual(['glob']);
  });

  test('does not track write events in parallel batch', () => {
    const sessionId = 'session-1';
    
    // Fire a write event (side-effect tool)
    recordToolExecution(activeBatches, sessionId, 'write');

    // Batch should NOT exist (write is not a read-only tool)
    const batch = activeBatches.get(sessionId);
    expect(batch).toBeUndefined();
  });

  test('does not track edit events in parallel batch', () => {
    const sessionId = 'session-1';
    
    // Fire an edit event (side-effect tool)
    recordToolExecution(activeBatches, sessionId, 'edit');

    // Batch should NOT exist
    const batch = activeBatches.get(sessionId);
    expect(batch).toBeUndefined();
  });

  test('tracks only read-only tools: read, glob, grep, webfetch, todoread', () => {
    const sessionId = 'session-1';
    const readOnlyTools = ['read', 'glob', 'grep', 'webfetch', 'todoread'];
    
    for (const tool of readOnlyTools) {
      recordToolExecution(activeBatches, sessionId, tool);
    }

    const batch = activeBatches.get(sessionId);
    expect(batch).toBeDefined();
    expect(batch?.toolNames).toHaveLength(5);
    expect(batch?.toolNames).toEqual(readOnlyTools);
  });

  test('disposeSessionBatch clears timers and batch', () => {
    const sessionId = 'session-1';
    
    // Create a batch
    recordToolExecution(activeBatches, sessionId, 'read');

    expect(activeBatches.has(sessionId)).toBe(true);

    // Dispose
    disposeSessionBatch(activeBatches, sessionId);

    expect(activeBatches.has(sessionId)).toBe(false);
  });
});

describe('Verification Step Detection', () => {
  let verificationSteps: Set<VerificationStep>;
  let markVerificationStep: (step: VerificationStep) => void;
  let hook: ReturnType<typeof createToolExecuteAfterHook>;

  beforeEach(() => {
    verificationSteps = new Set();
    markVerificationStep = (step: VerificationStep) => verificationSteps.add(step);
    
    hook = createToolExecuteAfterHook(
      markVerificationStep,
      () => 'setu',
      () => null
    );
  });

  test('detects build commands', async () => {
    await hook(
      { tool: 'bash', sessionID: 'session-1', callID: 'call-1', args: { command: 'bun build' } },
      { title: 'Building project', output: 'bun build completed', metadata: null }
    );

    expect(verificationSteps.has('build')).toBe(true);
  });

  test('detects test commands', async () => {
    await hook(
      { tool: 'bash', sessionID: 'session-1', callID: 'call-1', args: { command: 'npm test' } },
      { title: 'Running tests', output: 'npm test completed', metadata: null }
    );

    expect(verificationSteps.has('test')).toBe(true);
  });

  test('detects lint commands', async () => {
    await hook(
      { tool: 'bash', sessionID: 'session-1', callID: 'call-1', args: { command: 'eslint' } },
      { title: 'Linting', output: 'eslint completed', metadata: null }
    );

    expect(verificationSteps.has('lint')).toBe(true);
  });

  test('does not trigger on non-bash tools', async () => {
    await hook(
      { tool: 'read', sessionID: 'session-1', callID: 'call-1', args: { filePath: 'package.json' } },
      { title: 'build', output: 'npm run build', metadata: null }
    );

    expect(verificationSteps.size).toBe(0);
  });
});
