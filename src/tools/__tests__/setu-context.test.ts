import { describe, expect, test } from 'bun:test';
import { createSetuContextTool } from '../setu-context';
import { clearDisciplineState, getDisciplineState, setQuestionBlocked } from '../../context';

describe('setu_context decision checkpoint behavior', () => {
  test('clears question block even when hydration is already confirmed', async () => {
    const sessionID = 'setu-context-clears-question-block';
    setQuestionBlocked(sessionID, 'Need output format preference');

    const hydrationState = {
      contextConfirmed: true,
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
    ) as unknown as {
      execute: (args: { summary: string; task: string; plan?: string }, context: { sessionID: string }) => Promise<string>;
    };

    const result = await toolDef.execute(
      {
        summary: 'Task context understood',
        task: 'Create a quote file',
      },
      { sessionID }
    );

    expect(result).toContain('already confirmed');
    expect(getDisciplineState(sessionID).questionBlocked).toBe(false);

    clearDisciplineState(sessionID);
  });
});
