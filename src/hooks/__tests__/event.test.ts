import { describe, expect, test, mock } from 'bun:test';
import { createEventHook } from '../event';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('event hook session agent cleanup', () => {
  test('clears tracked session agent on session.created', async () => {
    const cleared: string[] = [];
    const hook = createEventHook(
      () => {},
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      (sessionID) => {
        cleared.push(sessionID);
      }
    );

    await hook({ event: { type: 'session.created', properties: { sessionID: 'session-a' } } });

    expect(cleared).toEqual(['session-a']);
  });

  test('clears tracked session agent on session.deleted', async () => {
    const cleared: string[] = [];
    const hook = createEventHook(
      () => {},
      () => {},
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      (sessionID) => {
        cleared.push(sessionID);
      }
    );

    await hook({ event: { type: 'session.deleted', properties: { sessionID: 'session-b' } } });

    expect(cleared).toEqual(['session-b']);
  });
});
