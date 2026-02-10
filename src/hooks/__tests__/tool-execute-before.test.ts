import { describe, expect, test, mock } from 'bun:test';
import { createToolExecuteBeforeHook } from '../tool-execute';
import { setQuestionBlocked, getSetuState, clearSetuState } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook protocol gating', () => {
  test('blocks non-question tools while protocol decision is pending', async () => {
    const sessionID = 'protocol-pending-session';
    setQuestionBlocked(sessionID, 'Need architecture clarification');

    const hook = createToolExecuteBeforeHook(
      () => ({ sessionId: 's-1', startedAt: Date.now(), contextConfirmed: true, attempts: 1, blockedTools: new Set() }),
      () => 'setu'
    );

    await expect(
      hook(
        { tool: 'read', sessionID, callID: 'call-1' },
        { args: { filePath: 'README.md' } }
      )
    ).rejects.toThrow('Clarification required before continuing');

    clearSetuState(sessionID);
  });

  test('question tool clears pending protocol state', async () => {
    const sessionID = 'protocol-question-session';
    setQuestionBlocked(sessionID, 'Need architecture clarification');

    const hook = createToolExecuteBeforeHook(
      () => ({ sessionId: 's-2', startedAt: Date.now(), contextConfirmed: true, attempts: 1, blockedTools: new Set() }),
      () => 'setu'
    );

    await hook(
      { tool: 'question', sessionID, callID: 'call-2' },
      {
        args: {
          questions: [
            {
              question: 'Choose path',
              header: 'Protocol',
              options: [
                { label: 'Save Research + Plan', description: 'Recommended path' },
              ],
            },
          ],
        },
      }
    );

    expect(getSetuState(sessionID).pendingQuestion).toBe(false);
    clearSetuState(sessionID);
  });
});
