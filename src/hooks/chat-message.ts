/**
 * Chat message hook - Detects style keywords and handles style switching
 * 
 * Uses: chat.message
 * 
 * Detects magic commands like `:quick`, `style: quick`, or `mode: collab` 
 * and updates the plugin state accordingly.
 * 
 * Magic Command Patterns (in order of precedence):
 * 1. Prefix: `:quick`, `:ultrathink`, `:collab`
 * 2. Key-Value: `style: quick`, `mode: quick`, `preset: quick`
 * 3. Aliases: `:fast` → quick, `:trust` → collab
 * 
 * Also tracks the current agent for style-aware enforcement.
 */

import { detectStyle, type StyleState } from '../prompts/styles';
import { STYLE_DISPLAY } from '../constants';
import { debugLog } from '../debug';

/**
 * Agent state tracking
 * Tracks which OpenCode agent is currently active (setu, build, plan, etc.)
 */
export interface AgentState {
  current: string;
  isSetuActive: boolean;
}

/**
 * Creates a chat-message processing hook that detects style keywords and updates style state.
 *
 * The returned hook scans message parts for persistent style keywords and updates
 * the provided style state accordingly. If provided, the optional `setAgentState` callback is
 * invoked with the message agent to track the active agent.
 *
 * @param getStyleState - Callback that returns the current style state
 * @param setStyleState - Callback to apply a new style state
 * @param setAgentState - Optional callback invoked with the message's agent identifier when present
 * @returns A hook function that processes an input message and its output parts, updating style and agent state
 */
export function createChatMessageHook(
  getStyleState: () => StyleState,
  setStyleState: (state: StyleState) => void,
  setAgentState?: (agent: string) => void
) {
  // Track temporary style for restoration after one task
  let temporaryStyleActive = false;
  let styleBeforeTemporary: StyleState['current'] | null = null;

  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    const currentState = getStyleState();
    
    // Track the current agent if provided
    if (input.agent && setAgentState) {
      setAgentState(input.agent);
    }
    
    // Scan parts for mode keywords (magic commands)
    for (const part of output.parts) {
      if (part.type === 'text' && typeof part.content === 'string') {
        const detected = detectStyle(part.content);
        
        if (detected) {
          const previousStyle = currentState.current;
          const newStyle = detected.style;
          
          if (detected.isPersistent) {
            // Persistent style change
            setStyleState({
              current: newStyle,
              isPersistent: true
            });
            temporaryStyleActive = false;
            styleBeforeTemporary = null;
            
            // Log the style change (visible to user via debug.log if SETU_DEBUG=true)
            const displayName = STYLE_DISPLAY[newStyle];
            debugLog(`[Style: ${displayName}] switched from ${STYLE_DISPLAY[previousStyle]}`);
            
            // NOTE: Toast emission would happen here if OpenCode exposes a TUI bus
            // For now, the model will acknowledge via [Style: X] in its response
            // if system-transform injects the style reminder
          } else {
            // Temporary style - save current and will restore after
            if (!temporaryStyleActive) {
              styleBeforeTemporary = currentState.current;
            }
            setStyleState({
              current: newStyle,
              isPersistent: false
            });
            temporaryStyleActive = true;
            debugLog(`Temporary style: ${STYLE_DISPLAY[newStyle]}`);
          }
          break; // Only process first style keyword found
        }
      }
    }
    
    // Restore from temporary style after processing
    // Note: This happens on the NEXT message after a temporary style was used
    if (temporaryStyleActive && styleBeforeTemporary && !output.parts.some(p => {
      if (p.type === 'text' && typeof p.content === 'string') {
        return detectStyle(p.content) !== null;
      }
      return false;
    })) {
      setStyleState({
        current: styleBeforeTemporary,
        isPersistent: true
      });
      debugLog(`Restored style to ${STYLE_DISPLAY[styleBeforeTemporary]}`);
      temporaryStyleActive = false;
      styleBeforeTemporary = null;
    }
  };
}