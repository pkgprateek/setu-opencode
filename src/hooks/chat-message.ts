/**
 * Chat message hook - Detects mode keywords and handles mode switching
 * 
 * Uses: chat.message
 * 
 * Detects mode keywords like "mode: quick" or "quick fix this" and updates
 * the plugin state accordingly.
 */

import { detectMode, type ModeState } from '../prompts/modes';

/**
 * Creates the chat message hook
 * 
 * Scans user message parts for mode keywords and updates state.
 * Supports both persistent ("mode: quick") and temporary ("quick fix") modes.
 */
export function createChatMessageHook(
  getModeState: () => ModeState,
  setModeState: (state: ModeState) => void
) {
  // Track temporary mode for restoration after one task
  let temporaryModeActive = false;
  let modeBeforeTemporary: ModeState['current'] | null = null;

  return async (
    _input: { sessionID: string; agent?: string; messageID?: string },
    output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    const currentState = getModeState();
    
    // Scan parts for mode keywords
    for (const part of output.parts) {
      if (part.type === 'text' && typeof part.content === 'string') {
        const detected = detectMode(part.content);
        
        if (detected) {
          if (detected.isPersistent) {
            // Persistent mode change
            setModeState({
              current: detected.mode,
              isPersistent: true
            });
            temporaryModeActive = false;
            modeBeforeTemporary = null;
            console.log(`[Setu] Mode switched to ${detected.mode} (persistent)`);
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
            console.log(`[Setu] Temporary mode: ${detected.mode}`);
          }
          break; // Only process first mode keyword found
        }
      }
    }
    
    // Restore from temporary mode after processing
    // Note: This happens on the NEXT message after a temporary mode was used
    if (temporaryModeActive && modeBeforeTemporary && !output.parts.some(p => {
      if (p.type === 'text' && typeof p.content === 'string') {
        return detectMode(p.content) !== null;
      }
      return false;
    })) {
      setModeState({
        current: modeBeforeTemporary,
        isPersistent: true
      });
      console.log(`[Setu] Restored mode to ${modeBeforeTemporary}`);
      temporaryModeActive = false;
      modeBeforeTemporary = null;
    }
  };
}
