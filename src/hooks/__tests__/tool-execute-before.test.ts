import { describe, expect, test, mock } from 'bun:test';
import { createToolExecuteBeforeHook, createToolExecuteAfterHook } from '../tool-execute';
import { setQuestionBlocked, getDisciplineState, clearDisciplineState } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook protocol gating', () => {
  test('allows read-only tools while protocol decision is pending', async () => {
    const sessionID = 'protocol-pending-session';
    setQuestionBlocked(sessionID, 'Need architecture clarification');

    const hook = createToolExecuteBeforeHook(
      () => 'setu'
    );

    try {
      await expect(
        hook(
          { tool: 'read', sessionID, callID: 'call-1' },
          { args: { filePath: 'README.md' } }
        )
      ).resolves.toBeUndefined();

      await expect(
        hook(
          { tool: 'write', sessionID, callID: 'call-1b' },
          { args: { filePath: 'README.md', content: 'x' } }
        )
      ).rejects.toThrow('Wait:');
    } finally {
      clearDisciplineState(sessionID);
    }
  });

  test('allows read-only bash and blocks mutating bash while clarification is pending', async () => {
    const sessionID = 'protocol-pending-bash-session';
    setQuestionBlocked(sessionID, 'Need deployment confirmation');

    const hook = createToolExecuteBeforeHook(
      () => 'setu'
    );

    try {
      await expect(
        hook(
          { tool: 'bash', sessionID, callID: 'call-1c' },
          { args: { command: 'git status' } }
        )
      ).resolves.toBeUndefined();

      await expect(
        hook(
          { tool: 'bash', sessionID, callID: 'call-1d' },
          { args: { command: 'git commit -m "x"' } }
        )
      ).rejects.toThrow('Wait:');
    } finally {
      clearDisciplineState(sessionID);
    }
  });

  test('allows setu_doctor while clarification is pending', async () => {
    const sessionID = 'protocol-pending-doctor-session';
    setQuestionBlocked(sessionID, 'Need output format preference');

    const hook = createToolExecuteBeforeHook(
      () => 'setu'
    );

    try {
      await expect(
        hook(
          { tool: 'setu_doctor', sessionID, callID: 'call-1e' },
          { args: { verbose: true } }
        )
      ).resolves.toBeUndefined();
    } finally {
      clearDisciplineState(sessionID);
    }
  });

  test('question completion clears pending protocol state in after hook', async () => {
    const sessionID = 'protocol-question-session';
    setQuestionBlocked(sessionID, 'Need architecture clarification');

    const beforeHook = createToolExecuteBeforeHook(
      () => 'setu'
    );
    const afterHook = createToolExecuteAfterHook(
      () => {},
      () => 'setu',
      () => null
    );

    try {
      await expect(
        beforeHook(
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
        )
      ).resolves.toBeUndefined();

      // Before hook should allow question but not clear state yet.
      expect(getDisciplineState(sessionID).questionBlocked).toBe(true);

      await afterHook(
        { tool: 'question', sessionID, callID: 'call-2', args: {} },
        { title: 'Question', output: 'Answered', metadata: null }
      );

      expect(getDisciplineState(sessionID).questionBlocked).toBe(false);
    } finally {
      clearDisciplineState(sessionID);
    }
  });
});
