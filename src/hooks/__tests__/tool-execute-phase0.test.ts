import { describe, expect, test, mock } from 'bun:test';
import { createToolExecuteBeforeHook } from '../tool-execute';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook phase 0 enforcement', () => {
  test('blocks write before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
      undefined,
      () => ({ contextConfirmed: false, sessionId: 's1', startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID: 's1', callID: 'c1' },
        { args: { filePath: 'a.txt', content: 'x' } }
      )
    ).rejects.toThrow('understand the context first');
  });

  test('allows read-only tools before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
      undefined,
      () => ({ contextConfirmed: false, sessionId: 's2', startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'read', sessionID: 's2', callID: 'c2' },
        { args: { filePath: 'README.md' } }
      )
    ).resolves.toBeUndefined();
  });

  test('allows setu_context before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
      undefined,
      () => ({ contextConfirmed: false, sessionId: 's3', startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'setu_context', sessionID: 's3', callID: 'c3' },
        { args: { summary: 'x', task: 'y' } }
      )
    ).resolves.toBeUndefined();
  });

  test('unlocks write after context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      undefined,
      undefined,
      () => ({ contextConfirmed: true, sessionId: 's4', startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID: 's4', callID: 'c4' },
        { args: { filePath: 'new-file.txt', content: 'ok' } }
      )
    ).resolves.toBeUndefined();
  });
});
