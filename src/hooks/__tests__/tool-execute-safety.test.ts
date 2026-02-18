import { afterEach, describe, expect, test, mock, beforeEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createToolExecuteBeforeHook, createToolExecuteAfterHook } from '../tool-execute';
import { clearDisciplineState, getPendingSafetyConfirmation } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook safety flow', () => {
  let projectDir = '';

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'setu-safety-'));
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    // Create required artifacts for builder gear
    const fs = require('fs');
    fs.writeFileSync(join(setuDir, 'RESEARCH.md'), '# Research', 'utf-8');
    fs.writeFileSync(join(setuDir, 'PLAN.md'), '# Plan', 'utf-8');
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('destructive command is hard blocked', async () => {
    const sessionID = 'safety-hard-block';
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'bash', sessionID, callID: 'hard-1' },
        { args: { command: 'rm -rf /tmp/demo' } }
      )
    ).rejects.toThrow('Wait:');

    // Verify security audit log entry
    const securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('SAFETY_BLOCKED');
    expect(securityLog).toContain('tool:bash');

    clearDisciplineState(sessionID);
  });

  test('ask flow requires approval and re-approval every attempt', async () => {
    const sessionID = 'safety-ask-flow';
    const beforeHook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );
    const afterHook = createToolExecuteAfterHook(
      () => {},
      () => 'setu',
      () => null
    );

    // Initial risky command is blocked and requires question/approval.
    await expect(
      beforeHook(
        { tool: 'bash', sessionID, callID: 'ask-1' },
        { args: { command: 'npm publish' } }
      )
    ).rejects.toThrow('Wait:');

    // Verify SAFETY_BLOCKED was logged
    let securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('SAFETY_BLOCKED');

    // Question call is allowed.
    await expect(
      beforeHook(
        { tool: 'question', sessionID, callID: 'ask-q1' },
        {
          args: {
            questions: [
              {
                question: 'Proceed?',
                header: 'Safety',
                options: [
                  { label: 'Proceed - I understand the risk', description: 'continue' },
                  { label: 'Cancel - use a safer alternative', description: 'abort' },
                ],
              },
            ],
          },
        }
      )
    ).resolves.toBeUndefined();

    // User approves via question answer.
    await afterHook(
      { tool: 'question', sessionID, callID: 'ask-q1', args: {} },
      {
        title: 'Safety response',
        output: 'Proceed - I understand the risk',
        metadata: { answer: 'Proceed - I understand the risk' },
      }
    );

    // Same action is allowed once.
    await expect(
      beforeHook(
        { tool: 'bash', sessionID, callID: 'ask-2' },
        { args: { command: 'npm publish' } }
      )
    ).resolves.toBeUndefined();

    // Next same attempt requires fresh approval again.
    await expect(
      beforeHook(
        { tool: 'bash', sessionID, callID: 'ask-3' },
        { args: { command: 'npm publish' } }
      )
    ).rejects.toThrow('Wait:');

    clearDisciplineState(sessionID);
  });

  test('unrelated question response does not deny pending safety confirmation', async () => {
    const sessionID = 'safety-unrelated-question';

    const beforeHook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );
    const afterHook = createToolExecuteAfterHook(
      () => {},
      () => 'setu',
      () => null
    );

    await expect(
      beforeHook(
        { tool: 'bash', sessionID, callID: 'unrelated-1' },
        { args: { command: 'npm publish' } }
      )
    ).rejects.toThrow('Wait:');

    await expect(
      beforeHook(
        { tool: 'question', sessionID, callID: 'unrelated-q1' },
        { args: { questions: [{ question: 'Any update?', header: 'Status', options: [{ label: 'Yes', description: 'status' }] }] } }
      )
    ).resolves.toBeUndefined();

    await afterHook(
      { tool: 'question', sessionID, callID: 'unrelated-q1', args: {} },
      {
        title: 'Status response',
        output: 'Yes',
        metadata: { answer: 'Yes' },
      }
    );

    const pending = getPendingSafetyConfirmation(sessionID);
    expect(pending).not.toBeNull();
    expect(pending?.status).toBe('pending');

    clearDisciplineState(sessionID);
  });
});
