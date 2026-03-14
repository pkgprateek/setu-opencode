/**
 * Chat params hook - records the active agent as early as possible.
 */

import { debugLog, errorLog } from '../debug';
import { removeControlChars } from '../utils/sanitization';

type ChatParamsHook = (
  input: { sessionID: string; agent: string },
  output: {
    temperature: number;
    topP: number;
    topK: number;
    options: Record<string, unknown>;
  }
) => Promise<void>;

export function createChatParamsHook(
  setSessionAgent?: (sessionID: string, agent: string) => void
): ChatParamsHook {
  return async (
    input: { sessionID: string; agent: string },
    _output: {
      temperature: number;
      topP: number;
      topK: number;
      options: Record<string, unknown>;
    }
  ): Promise<void> => {
    if (!setSessionAgent) {
      return;
    }

    const rawSessionID = input.sessionID ?? '';
    const safeSessionID = removeControlChars(rawSessionID).trim();
    const safeAgent = removeControlChars(input.agent ?? '').trim();

    if (!safeSessionID) {
      errorLog('[setu] security_event hook=chat.params type=empty_sanitized_session_id');
      return;
    }

    if (!safeAgent) {
      errorLog('[setu] security_event hook=chat.params type=empty_sanitized_agent');
      return;
    }

    try {
      setSessionAgent(safeSessionID, safeAgent);
    } catch (error) {
      debugLog('Failed to record session agent from chat.params:', error);
    }
  };
}
