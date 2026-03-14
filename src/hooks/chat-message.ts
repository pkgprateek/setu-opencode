/**
 * Chat message hook - tracks the active agent per session.
 */

import { debugLog, errorLog } from '../debug';
import { removeControlChars } from '../utils/sanitization';

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
 * Creates a chat-message processing hook that tracks the active agent per session.
 */
export function createChatMessageHook(
  setSessionAgent?: (sessionID: string, agent: string) => void,
  onSetuMessage?: (sessionID: string) => void
): ChatMessageHook {
  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    _output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    const rawSessionID = input.sessionID ?? '';
    const safeSessionID = removeControlChars(rawSessionID).trim();
    const safeAgent = removeControlChars(input.agent ?? '').trim();

    if (safeAgent === 'setu' && onSetuMessage) {
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

    if (setSessionAgent) {
      try {
        if (!safeSessionID) {
          errorLog('[setu] security_event hook=chat.message type=empty_sanitized_session_id');
        } else {
          setSessionAgent(safeSessionID, safeAgent);
          if (!safeAgent) {
            errorLog('[setu] security_event hook=chat.message type=empty_sanitized_agent');
          }
        }
      } catch (error) {
        // Graceful degradation: agent tracking is non-critical
        debugLog('Failed to set session agent:', error);
      }
    }
  };
}
