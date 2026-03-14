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

  test('chat.params clears stale agent state when sanitized agent is empty', async () => {
    const sessionAgents = new Map<string, string>();
    const hook = createChatParamsHook((sessionID, agent) => {
      if (agent.trim()) {
        sessionAgents.set(sessionID, agent);
        return;
      }
      sessionAgents.delete(sessionID);
    });

    await hook(
      { sessionID: 'session-a', agent: 'setu' },
      { temperature: 0, topP: 1, topK: 1, options: {} }
    );
    await hook(
      { sessionID: 'session-a', agent: '\u0000\t ' },
      { temperature: 0, topP: 1, topK: 1, options: {} }
    );

    expect(sessionAgents.has('session-a')).toBe(false);
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

  test('chat.message clears stale agent state when sanitized agent is empty', async () => {
    const sessionAgents = new Map<string, string>();
    const hook = createChatMessageHook((sessionID, agent) => {
      if (agent.trim()) {
        sessionAgents.set(sessionID, agent);
        return;
      }
      sessionAgents.delete(sessionID);
    });

    await hook(
      { sessionID: 'session-a', agent: 'setu' },
      { message: { id: 'm1' }, parts: [] }
    );
    await hook(
      { sessionID: 'session-a', agent: '\u0000 ' },
      { message: { id: 'm2' }, parts: [] }
    );

    expect(sessionAgents.has('session-a')).toBe(false);
  });
});
