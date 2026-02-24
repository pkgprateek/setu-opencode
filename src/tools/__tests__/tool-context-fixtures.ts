import type { ToolContext } from '@opencode-ai/plugin';

/**
 * Shared ToolContext fixture for tool unit tests.
 *
 * Keep this strongly typed so tests fail at compile time when ToolContext changes.
 */
export function createMockToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  const metadata: ToolContext['metadata'] = () => undefined;
  const ask: ToolContext['ask'] = async () => undefined;

  const base: ToolContext = {
    sessionID: 'test-session',
    messageID: 'test-msg-1',
    agent: 'setu',
    abort: new AbortController().signal,
    metadata,
    ask,
    directory: process.cwd(),
    worktree: process.cwd(),
  };

  return {
    ...base,
    ...overrides,
  };
}
