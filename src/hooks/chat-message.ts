/**
 * Chat message hook - Detects profile keywords and handles profile switching
 * 
 * Uses: chat.message
 * 
 * Detects profile keywords like "mode: quick" or "mode: expert" and updates
 * the plugin state accordingly.
 * 
 * Also tracks the current agent for profile-aware enforcement.
 */

import { detectProfile, type ProfileState } from '../prompts/profiles';
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
 * Creates a chat-message processing hook that detects profile keywords and updates profile state.
 *
 * The returned hook scans message parts for persistent profile keywords and updates
 * the provided profile state accordingly. If provided, the optional `setAgentState` callback is
 * invoked with the message agent to track the active agent.
 *
 * @param getProfileState - Callback that returns the current profile state
 * @param setProfileState - Callback to apply a new profile state
 * @param setAgentState - Optional callback invoked with the message's agent identifier when present
 * @returns A hook function that processes an input message and its output parts, updating profile and agent state
 */
export function createChatMessageHook(
  getProfileState: () => ProfileState,
  setProfileState: (state: ProfileState) => void,
  setAgentState?: (agent: string) => void
) {
  // Track temporary style for restoration after one task
  let temporaryStyleActive = false;
  let styleBeforeTemporary: ProfileState['current'] | null = null;

  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    const currentState = getProfileState();
    
    // Track the current agent if provided
    if (input.agent && setAgentState) {
      setAgentState(input.agent);
    }
    
    // Scan parts for mode keywords
    for (const part of output.parts) {
      if (part.type === 'text' && typeof part.content === 'string') {
        const detected = detectProfile(part.content);
        
        if (detected) {
          if (detected.isPersistent) {
            // Persistent style change
            setProfileState({
              current: detected.profile,
              isPersistent: true
            });
            temporaryStyleActive = false;
            styleBeforeTemporary = null;
            debugLog(`Style switched to ${detected.profile} (persistent)`);
          } else {
            // Temporary style - save current and will restore after
            if (!temporaryStyleActive) {
              styleBeforeTemporary = currentState.current;
            }
            setProfileState({
              current: detected.profile,
              isPersistent: false
            });
            temporaryStyleActive = true;
            debugLog(`Temporary style: ${detected.profile}`);
          }
          break; // Only process first style keyword found
        }
      }
    }
    
    // Restore from temporary style after processing
    // Note: This happens on the NEXT message after a temporary style was used
    if (temporaryStyleActive && styleBeforeTemporary && !output.parts.some(p => {
      if (p.type === 'text' && typeof p.content === 'string') {
        return detectProfile(p.content) !== null;
      }
      return false;
    })) {
      setProfileState({
        current: styleBeforeTemporary,
        isPersistent: true
      });
      debugLog(`Restored style to ${styleBeforeTemporary}`);
      temporaryStyleActive = false;
      styleBeforeTemporary = null;
    }
  };
}