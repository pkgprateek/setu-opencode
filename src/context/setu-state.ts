/**
 * Discipline guards - safety mechanisms that can activate at any gear.
 * These are NOT workflow phases. Gears handle workflow order.
 */
export interface SetuDisciplineState {
  /** Whether a clarification question must be answered before continuing */
  questionBlocked: boolean;
  /** Reason for question block (displayed to agent) */
  questionReason?: string;
  /** Whether a safety classifier triggered a block */
  safetyBlocked: boolean;
  /** When this state was last updated (for TTL) */
  updatedAt: number;
}

export interface OverwriteRequirementState {
  pending: boolean;
  filePath: string;
  createdAt: number;
}

const sessionStates = new Map<string, SetuDisciplineState>();
const overwriteRequirements = new Map<string, OverwriteRequirementState>();
const STATE_TTL_MS = 30 * 60 * 1000;
const OVERWRITE_REQUIREMENT_TTL_MS = 10 * 60 * 1000;

function isStale(updatedAt: number, ttlMs: number): boolean {
  return Date.now() - updatedAt > ttlMs;
}

export function getDisciplineState(sessionID: string): SetuDisciplineState {
  const state = sessionStates.get(sessionID);
  if (!state || isStale(state.updatedAt, STATE_TTL_MS)) {
    // Preserve safetyBlocked across TTL expiry — safety decisions
    // must be explicitly cleared, never silently lapsed
    const preservedSafetyBlocked = state?.safetyBlocked ?? false;
    const initial: SetuDisciplineState = {
      questionBlocked: false,
      safetyBlocked: preservedSafetyBlocked,
      updatedAt: Date.now(),
    };
    sessionStates.set(sessionID, initial);
    return initial;
  }

  return state;
}

export function setDisciplineState(sessionID: string, state: Omit<SetuDisciplineState, 'updatedAt'>): void {
  sessionStates.set(sessionID, {
    ...state,
    updatedAt: Date.now(),
  });
}

export function setQuestionBlocked(sessionID: string, reason: string): void {
  const state = getDisciplineState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    questionBlocked: true,
    questionReason: reason,
    updatedAt: Date.now(),
  });
}

export function clearQuestionBlocked(sessionID: string): void {
  const state = getDisciplineState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    questionBlocked: false,
    questionReason: undefined,
    updatedAt: Date.now(),
  });
}

export function setSafetyBlocked(sessionID: string): void {
  const state = getDisciplineState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    safetyBlocked: true,
    updatedAt: Date.now(),
  });
}

export function clearSafetyBlocked(sessionID: string): void {
  const state = getDisciplineState(sessionID);
  sessionStates.set(sessionID, {
    ...state,
    safetyBlocked: false,
    updatedAt: Date.now(),
  });
}

export function clearDisciplineState(sessionID: string): void {
  sessionStates.delete(sessionID);
  overwriteRequirements.delete(sessionID);
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
