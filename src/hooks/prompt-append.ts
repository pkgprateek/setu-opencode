/**
 * Prompt append hook - Detects mode keywords and adds mode prefix to responses
 */

import { detectMode, type SetuMode, type ModeState } from '../prompts/modes';
import { getModePrefix } from '../prompts/persona';

export interface PromptAppendInput {
  prompt: string;
}

export interface PromptAppendOutput {
  prefix?: string;
  suffix?: string;
}

/**
 * Creates a tui.prompt.append hook handler
 * 
 * This hook:
 * 1. Detects mode keywords in user prompts
 * 2. Updates mode state (persistent or temporary)
 * 3. Adds mode prefix to responses
 */
export function createPromptAppendHook(
  getModeState: () => ModeState,
  setModeState: (state: ModeState) => void,
  getDefaultMode: () => SetuMode
) {
  // Track the last temporary mode for restoration
  let temporaryModeActive = false;
  let modeBeforeTemporary: SetuMode | null = null;

  return async (
    input: PromptAppendInput,
    output: PromptAppendOutput
  ): Promise<void> => {
    const currentState = getModeState();
    
    // Detect mode from prompt
    const detected = detectMode(input.prompt);
    
    if (detected) {
      if (detected.isPersistent) {
        // Persistent mode change
        setModeState({
          current: detected.mode,
          isPersistent: true
        });
        temporaryModeActive = false;
        modeBeforeTemporary = null;
      } else {
        // Temporary mode - save current and will restore after
        if (!temporaryModeActive) {
          modeBeforeTemporary = currentState.current;
        }
        setModeState({
          current: detected.mode,
          isPersistent: false
        });
        temporaryModeActive = true;
      }
      
      // Add mode prefix
      output.prefix = getModePrefix(detected.mode) + ' ';
    } else if (temporaryModeActive && modeBeforeTemporary) {
      // Restore from temporary mode after one interaction
      setModeState({
        current: modeBeforeTemporary,
        isPersistent: true
      });
      temporaryModeActive = false;
      output.prefix = getModePrefix(modeBeforeTemporary) + ' ';
      modeBeforeTemporary = null;
    } else {
      // No change, just add current mode prefix
      output.prefix = getModePrefix(currentState.current) + ' ';
    }
  };
}
