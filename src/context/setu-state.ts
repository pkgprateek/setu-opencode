export type SetuPhase =
  | 'received'
  | 'researching'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'done'
  | 'blocked_safety'
  | 'blocked_question';

export interface SetuSessionState {
  phase: SetuPhase;
  pendingQuestion: boolean;
  questionReason?: string;
  updatedAt: number;
}

export interface OverwriteRequirementState {
  pending: boolean;
  filePath: string;
  createdAt: number;
}

const sessionStates = new Map<string, SetuSessionState>();
const overwriteRequirements = new Map<string, OverwriteRequirementState>();
const STATE_TTL_MS = 30 * 60 * 1000;
const OVERWRITE_REQUIREMENT_TTL_MS = 10 * 60 * 1000;

function isStale(updatedAt: number, ttlMs: number): boolean {
  return Date.now() - updatedAt > ttlMs;
}

export function getSetuState(sessionID: string): SetuSessionState {
  const state = sessionStates.get(sessionID);
  if (!state || isStale(state.updatedAt, STATE_TTL_MS)) {
    const initial: SetuSessionState = {
      phase: 'received',
      pendingQuestion: false,
      updatedAt: Date.now(),
    };
    sessionStates.set(sessionID, initial);
    return initial;
  }

  return state;
}

export function setSetuState(sessionID: string, state: Omit<SetuSessionState, 'updatedAt'>): void {
  sessionStates.set(sessionID, {
    ...state,
    updatedAt: Date.now(),
  });
}

export function transitionSetuPhase(sessionID: string, phase: SetuPhase): void {
  const state = getSetuState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    phase,
    updatedAt: Date.now(),
  });
}

export function setQuestionBlocked(sessionID: string, reason: string): void {
  const state = getSetuState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    phase: 'blocked_question',
    pendingQuestion: true,
    questionReason: reason,
    updatedAt: Date.now(),
  });
}

export function clearQuestionBlocked(sessionID: string): void {
  const state = getSetuState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    pendingQuestion: false,
    questionReason: undefined,
    phase: state.phase === 'blocked_question' ? 'researching' : state.phase,
    updatedAt: Date.now(),
  });
}

export function clearSetuState(sessionID: string): void {
  sessionStates.delete(sessionID);
}

export function setOverwriteRequirement(sessionID: string, state: OverwriteRequirementState): void {
  overwriteRequirements.set(sessionID, state);
}

export function getOverwriteRequirement(sessionID: string): OverwriteRequirementState | null {
  const state = overwriteRequirements.get(sessionID);
  if (!state) {
    return null;
  }

  if (isStale(state.createdAt, OVERWRITE_REQUIREMENT_TTL_MS)) {
    overwriteRequirements.delete(sessionID);
    return null;
  }

  return state;
}

export function clearOverwriteRequirement(sessionID: string): void {
  overwriteRequirements.delete(sessionID);
}
