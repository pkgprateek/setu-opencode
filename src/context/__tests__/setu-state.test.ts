import { describe, expect, test } from 'bun:test';
import {
  getSetuState,
  setSetuState,
  transitionSetuPhase,
  setQuestionBlocked,
  clearQuestionBlocked,
  clearSetuState,
  setOverwriteRequirement,
  getOverwriteRequirement,
  clearOverwriteRequirement,
} from '../setu-state';

describe('setu runtime state', () => {
  test('initializes state on first access', () => {
    const sessionID = 'state-init';
    const state = getSetuState(sessionID);
    expect(state.phase).toBe('received');
    expect(state.pendingQuestion).toBe(false);
    clearSetuState(sessionID);
  });

  test('transitions phase and question block lifecycle', () => {
    const sessionID = 'state-transition';
    setSetuState(sessionID, { phase: 'researching', pendingQuestion: false });
    transitionSetuPhase(sessionID, 'planning');
    expect(getSetuState(sessionID).phase).toBe('planning');

    setQuestionBlocked(sessionID, 'Need DB preference');
    expect(getSetuState(sessionID).pendingQuestion).toBe(true);
    expect(getSetuState(sessionID).phase).toBe('blocked_question');

    clearQuestionBlocked(sessionID);
    expect(getSetuState(sessionID).pendingQuestion).toBe(false);
    expect(getSetuState(sessionID).phase).toBe('researching');
    clearSetuState(sessionID);
  });

  test('stores and clears overwrite requirement', () => {
    const sessionID = 'state-overwrite';
    setOverwriteRequirement(sessionID, {
      pending: true,
      filePath: 'hello.txt',
      createdAt: Date.now(),
    });

    expect(getOverwriteRequirement(sessionID)?.filePath).toBe('hello.txt');
    clearOverwriteRequirement(sessionID);
    expect(getOverwriteRequirement(sessionID)).toBeNull();
  });
});
