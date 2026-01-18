/**
 * Session start hook - Injects Setu persona at the beginning of each session
 */

import { getInitialPrompt, getModePrefix } from '../prompts/persona';
import type { SetuMode, ModeState } from '../prompts/modes';

export interface SessionCreatedInput {
  session: {
    id: string;
    createdAt: Date;
  };
}

export interface SessionCreatedOutput {
  inject?: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  };
}

/**
 * Creates a session.created hook handler
 * 
 * This hook injects the Setu persona as the first message in a new session.
 * The persona is lean (~500 tokens) to minimize context usage.
 */
export function createSessionStartHook(
  getModeState: () => ModeState,
  isFirstSession: () => boolean,
  setFirstSessionDone: () => void
) {
  return async (
    input: SessionCreatedInput,
    output: SessionCreatedOutput
  ): Promise<void> => {
    const modeState = getModeState();
    
    // Only inject full persona on first interaction
    // Subsequent sessions just get mode prefix
    if (isFirstSession()) {
      output.inject = {
        role: 'assistant',
        content: getInitialPrompt(modeState.current)
      };
      setFirstSessionDone();
    }
  };
}

/**
 * Handles mode changes during a session
 */
export function createModeChangeMessage(
  oldMode: SetuMode,
  newMode: SetuMode,
  isPersistent: boolean
): string {
  const persistenceNote = isPersistent 
    ? 'Mode will persist until changed.'
    : 'Mode applies to this task only.';
  
  return `${getModePrefix(newMode)}

Switching from ${oldMode} to ${newMode}. ${persistenceNote}`;
}
