/**
 * Chat message hook - tracks active agent only.
 */

/**
 * Agent state tracking
 */
export interface AgentState {
  current: string;
  isSetuActive: boolean;
}

/**
 * Creates a chat-message processing hook that tracks active agent.
 */
export function createChatMessageHook(
  setAgentState?: (agent: string) => void
) {
  return async (
    input: { sessionID: string; agent?: string; messageID?: string },
    _output: { message: { id: string }; parts: Array<{ type: string; content?: string }> }
  ): Promise<void> => {
    if (input.agent && setAgentState) {
      setAgentState(input.agent);
    }
  };
}
