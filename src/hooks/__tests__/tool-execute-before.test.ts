import { describe, expect, test, mock } from 'bun:test';
import { createToolExecuteBeforeHook } from '../tool-execute';
import { setQuestionBlocked, getDisciplineState, clearDisciplineState } from '../../context';

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
      () => 'setu'
    );

    await expect(
      hook(
        { tool: 'read', sessionID, callID: 'call-1' },
        { args: { filePath: 'README.md' } }
      )
    ).rejects.toThrow('Clarification required before continuing');

    clearDisciplineState(sessionID);
  });

  test('question tool clears pending protocol state', async () => {
    const sessionID = 'protocol-question-session';
    setQuestionBlocked(sessionID, 'Need architecture clarification');

    const hook = createToolExecuteBeforeHook(
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

    expect(getDisciplineState(sessionID).questionBlocked).toBe(false);
    clearDisciplineState(sessionID);
  });
});
