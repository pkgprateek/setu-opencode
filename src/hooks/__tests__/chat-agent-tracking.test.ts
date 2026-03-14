import { describe, expect, test, mock } from 'bun:test';
import { createChatParamsHook } from '../chat-params';
import { createChatMessageHook } from '../chat-message';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('chat agent tracking hooks', () => {
  test('chat.params records session agent early', async () => {
    const updates: Array<{ sessionID: string; agent: string }> = [];
    const hook = createChatParamsHook((sessionID, agent) => {
      updates.push({ sessionID, agent });
    });

    await hook(
      { sessionID: 'session-a', agent: 'build' },
      { temperature: 0, topP: 1, topK: 1, options: {} }
    );

    expect(updates).toEqual([{ sessionID: 'session-a', agent: 'build' }]);
  });

  test('chat.message records session agent and only signals exact setu', async () => {
    const updates: Array<{ sessionID: string; agent: string }> = [];
    const setuMessages: string[] = [];
    const hook = createChatMessageHook(
      (sessionID, agent) => {
        updates.push({ sessionID, agent });
      },
      (sessionID) => {
        setuMessages.push(sessionID);
      }
    );

    await hook(
      { sessionID: 'session-a', agent: 'build' },
      { message: { id: 'm1' }, parts: [] }
    );
    await hook(
      { sessionID: 'session-b', agent: 'setu' },
      { message: { id: 'm2' }, parts: [] }
    );

    expect(updates).toEqual([
      { sessionID: 'session-a', agent: 'build' },
      { sessionID: 'session-b', agent: 'setu' },
    ]);
    expect(setuMessages).toEqual(['session-b']);
  });
});
