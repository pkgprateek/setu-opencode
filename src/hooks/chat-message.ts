/**
 * Chat message hook - tracks active agent only.
 */

import { debugLog, errorLog } from '../debug';
import { removeControlChars } from '../utils/sanitization';

/**
 * Agent state tracking
 */
export interface AgentState {
  current: string;
  isSetuActive: boolean;
}

/**
 * Hook signature returned by createChatMessageHook.
 *
 * This hook receives every Setu chat message. Deduplication is the caller's
 * responsibility (for example, session-level guards in plugin state).
 */
type ChatMessageHook = (
  input: { sessionID: string; agent?: string; messageID?: string },
  output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
) => Promise<void>;

/**
 * Creates a chat-message processing hook that tracks active agent.
 */
export function createChatMessageHook(
  setAgentState?: (agent: string) => void,
  onSetuMessage?: (sessionID: string) => void
): ChatMessageHook {
  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    _output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    const rawSessionID = input.sessionID ?? '';
    const safeSessionID = removeControlChars(rawSessionID).trim();

    if (input.agent && input.agent.toLowerCase() === 'setu' && onSetuMessage) {
      try {
        if (!safeSessionID) {
          errorLog('[setu] security_event hook=onSetuMessage type=empty_sanitized_session_id');
        } else {
          onSetuMessage(safeSessionID);
        }
      } catch (error) {
        // Graceful degradation: lazy init is non-critical
        debugLog('Failed to invoke onSetuMessage callback:', error);
      }
    }

    if (input.agent && setAgentState) {
      try {
        setAgentState(input.agent);
      } catch (error) {
        // Graceful degradation: agent tracking is non-critical
        debugLog('Failed to set agent state:', error);
      }
    }
  };
}
