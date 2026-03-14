import type { ToolContext } from '@opencode-ai/plugin';
import { removeControlChars } from '../utils/sanitization';

const SETU_AGENT_NAME = 'setu';
const SETU_ONLY_PREFIX = 'Only available when the active agent is Setu.';

function normalizeAgent(agent: string | undefined): string {
  return removeControlChars(agent ?? '').trim();
}

export function assertSetuAgent(
  context: Pick<ToolContext, 'agent'> | undefined,
  toolName: string
): void {
  if (normalizeAgent(context?.agent) !== SETU_AGENT_NAME) {
    throw new Error(
      `Setu tools are only available in the Setu agent. Switch to Setu mode to use ${toolName}.`
    );
  }
}

export function withSetuOnlyDescription(description: string): string {
  return `${SETU_ONLY_PREFIX}\n\n${description}`;
}
