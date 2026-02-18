import { describe, expect, test } from 'bun:test';
import { createSetuContextTool } from '../setu-context';
import { clearDisciplineState, getDisciplineState, setQuestionBlocked } from '../../context';

describe('setu_context decision checkpoint behavior', () => {
  test('clears question block even when hydration is already confirmed', async () => {
    const sessionID = 'setu-context-clears-question-block';
    setQuestionBlocked(sessionID, 'Need output format preference');

    // Start with contextConfirmed: false so the callback actually gets exercised
    const hydrationState = {
      contextConfirmed: false,
      sessionId: sessionID,
      startedAt: Date.now(),
    };

    const toolDef = createSetuContextTool(
      () => hydrationState,
      () => {
        hydrationState.contextConfirmed = true;
      },
      () => null,
      () => process.cwd()
    );

    try {
      const result = await toolDef.execute(
        {
          summary: 'Task context understood',
          task: 'Create a quote file',
        },
        {
          sessionID,
          messageID: 'test-msg-1',
          agent: 'setu',
          abort: new AbortController().signal,
          metadata: {},
          ask: async () => {},
        } as any
      );

      expect(result).toContain('confirmed');
      expect(getDisciplineState(sessionID).questionBlocked).toBe(false);
      expect(hydrationState.contextConfirmed).toBe(true);
    } finally {
      clearDisciplineState(sessionID);
    }
  });
});
