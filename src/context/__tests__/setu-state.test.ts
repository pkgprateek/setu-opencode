import { describe, expect, test } from 'bun:test';
import {
  getDisciplineState,
  setQuestionBlocked,
  clearQuestionBlocked,
  setSafetyBlocked,
  clearSafetyBlocked,
  clearDisciplineState,
  setOverwriteRequirement,
  getOverwriteRequirement,
  clearOverwriteRequirement,
  setPendingSafetyConfirmation,
  getPendingSafetyConfirmation,
  approvePendingSafetyConfirmation,
  denyPendingSafetyConfirmation,
  clearPendingSafetyConfirmation,
} from '../setu-state';

describe('discipline guards', () => {
  test('initializes with clean state', () => {
    const sessionID = 'state-init';
    const state = getDisciplineState(sessionID);
    expect(state.questionBlocked).toBe(false);
    expect(state.safetyBlocked).toBe(false);
    clearDisciplineState(sessionID);
  });

  test('question block lifecycle', () => {
    const sessionID = 'state-question';
    setQuestionBlocked(sessionID, 'Need DB preference');
    expect(getDisciplineState(sessionID).questionBlocked).toBe(true);
    expect(getDisciplineState(sessionID).questionReason).toBe('Need DB preference');
    clearQuestionBlocked(sessionID);
    expect(getDisciplineState(sessionID).questionBlocked).toBe(false);
    clearDisciplineState(sessionID);
  });

  test('safety block lifecycle', () => {
    const sessionID = 'state-safety';
    setSafetyBlocked(sessionID);
    expect(getDisciplineState(sessionID).safetyBlocked).toBe(true);
    clearSafetyBlocked(sessionID);
    expect(getDisciplineState(sessionID).safetyBlocked).toBe(false);
    clearDisciplineState(sessionID);
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

  test('pending safety confirmation lifecycle', () => {
    const sessionID = 'state-pending-safety';
    const actionFingerprint = 'bash:{"command":"npm publish"}';

    setPendingSafetyConfirmation(sessionID, {
      actionFingerprint,
      reasons: ['Production-impacting command detected'],
    });
    expect(getPendingSafetyConfirmation(sessionID)?.status).toBe('pending');

    approvePendingSafetyConfirmation(sessionID, actionFingerprint);
    expect(getPendingSafetyConfirmation(sessionID)?.status).toBe('approved');

    denyPendingSafetyConfirmation(sessionID, actionFingerprint);
    expect(getPendingSafetyConfirmation(sessionID)?.status).toBe('denied');

    clearPendingSafetyConfirmation(sessionID);
    expect(getPendingSafetyConfirmation(sessionID)).toBeNull();
    clearDisciplineState(sessionID);
  });
});
