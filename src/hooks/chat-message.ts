/**
 * Chat message hook - tracks active agent only.
 */

import { debugLog } from '../debug';

/**
 * Agent state tracking
 */
export interface AgentState {
  current: string;
  isSetuActive: boolean;
}

/** Hook signature returned by createChatMessageHook */
type ChatMessageHook = (
  input: { sessionID: string; agent?: string; messageID?: string },
  output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
) => Promise<void>;

/**
 * Creates a chat-message processing hook that tracks active agent.
 */
export function createChatMessageHook(
  setAgentState?: (agent: string) => void,
  onFirstSetuMessageInSession?: (sessionID: string) => void
): ChatMessageHook {
  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    _output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    if (input.agent && input.agent.toLowerCase() === 'setu' && onFirstSetuMessageInSession) {
      try {
        onFirstSetuMessageInSession(input.sessionID);
      } catch (error) {
        // Graceful degradation: lazy init is non-critical
        debugLog('Failed to run first Setu message initialization:', error);
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
