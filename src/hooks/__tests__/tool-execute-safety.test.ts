import { afterEach, describe, expect, test, mock } from 'bun:test';
import { createToolExecuteBeforeHook, createToolExecuteAfterHook } from '../tool-execute';
import { clearDisciplineState, getPendingSafetyConfirmation } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook safety flow', () => {
  const sessionIDs: string[] = [];

  afterEach(() => {
    for (const sessionID of sessionIDs) {
      clearDisciplineState(sessionID);
    }
    sessionIDs.length = 0;
  });

  test('destructive command is hard blocked', async () => {
    const sessionID = 'safety-hard-block';
    sessionIDs.push(sessionID);
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'bash', sessionID, callID: 'hard-1' },
        { args: { command: 'rm -rf /tmp/demo' } }
      )
    ).rejects.toThrow('Execution paused by safety policy');
  });

  test('ask flow requires approval and re-approval every attempt', async () => {
    const sessionID = 'safety-ask-flow';
    sessionIDs.push(sessionID);
    const beforeHook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
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
    ).rejects.toThrow('Safety confirmation required');

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
    ).rejects.toThrow('Safety confirmation required');
  });

  test('unrelated question response does not deny pending safety confirmation', async () => {
    const sessionID = 'safety-unrelated-question';
    sessionIDs.push(sessionID);

    const beforeHook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
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
    ).rejects.toThrow('Safety confirmation required');

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
  });
});
