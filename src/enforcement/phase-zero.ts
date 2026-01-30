/**
 * Phase 0: Pre-emptive Context Gate
 * 
 * The core insight: Block side-effect tools until context is confirmed.
 * Allow read-only tools so the agent can form smart questions.
 * 
 * This is pre-emptive, not reactive. We prevent wrong actions rather
 * than fixing them after the damage is done.
 * 
 * Philosophy (from Anthropic's Constitution approach):
 * - Explain "why" not just "what" - models need to understand reasoning
 * - Prioritization: Safe → Contextual → Efficient → Helpful
 * - Hard constraints as bright lines, soft guidance for judgment
 */

import {
  SETU_TOOLS,
  READ_ONLY_TOOLS,
  SIDE_EFFECT_TOOLS,
  READ_ONLY_BASH_COMMANDS,
  GIT_WRITE_COMMANDS,
  isSetuTool,
  isReadOnlyToolName,
  isSideEffectTool,
  type ReadOnlyTool
} from '../constants';
import { debugLog } from '../debug';

// Re-export types and guards for backwards compatibility
export type { ReadOnlyTool };
export { isReadOnlyToolName, isSetuTool, isSideEffectTool };

// Re-export constants for modules that import from enforcement
export { READ_ONLY_TOOLS, SETU_TOOLS, SIDE_EFFECT_TOOLS };

export interface Phase0State {
  /** Whether context has been confirmed by user response */
  contextConfirmed: boolean;
  /** Session ID for isolation */
  sessionId: string;
  /** Timestamp when Phase 0 started */
  startedAt: number;
}

/**
 * Check if a tool is read-only and allowed during Phase 0
 * 
 * @deprecated Use isReadOnlyToolName() type guard instead for better type safety
 */
export function isReadOnlyTool(toolName: string): boolean {
  return isReadOnlyToolName(toolName);
}

/**
 * Check if a bash command is read-only
 * 
 * @param command - The full bash command string
 * @returns true if the command is read-only
 */
export function isReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim();
  
  // Check for git write commands first (they start with git)
  for (const gitCmd of GIT_WRITE_COMMANDS) {
    if (trimmed.startsWith(gitCmd)) {
      return false;
    }
  }
  
  // Get the first word/command
  const firstWord = trimmed.split(/\s+/)[0];
  
  // Check if it's a read-only command
  if (READ_ONLY_BASH_COMMANDS.includes(firstWord as typeof READ_ONLY_BASH_COMMANDS[number])) {
    return true;
  }
  
  // Check compound commands (e.g., "git status")
  const firstTwoWords = trimmed.split(/\s+/).slice(0, 2).join(' ');
  if (READ_ONLY_BASH_COMMANDS.includes(firstTwoWords as typeof READ_ONLY_BASH_COMMANDS[number])) {
    return true;
  }
  
  return false;
}

/**
 * Result of Phase 0 blocking check
 */
export interface Phase0BlockResult {
  blocked: boolean;
  reason?: string;
  details?: string;
}

/**
 * Decide whether a tool invocation should be blocked by Phase 0 safeguards.
 *
 * @param toolName - Name of the tool being invoked
 * @param args - Optional tool arguments; for `bash` the `command` string is examined to determine read-only status
 * @returns A Phase0BlockResult: `blocked` is `true` when the call should be prevented; `reason` is a block code (e.g., `bash_blocked`, `side_effect_blocked`) and `details` contains contextual information when available
 */
export function shouldBlockInPhase0(
  toolName: string,
  args?: Record<string, unknown>
): Phase0BlockResult {
  // Setu's own tools - always allowed
  if (isSetuTool(toolName)) {
    return { blocked: false };
  }
  
  // Always allow read-only tools
  if (isReadOnlyTool(toolName)) {
    return { blocked: false };
  }
  
  // Check bash commands
  if (toolName === 'bash') {
    const command = (args?.command as string) || '';
    if (isReadOnlyBashCommand(command)) {
      return { blocked: false };
    }
    return { 
      blocked: true, 
      reason: 'bash_blocked',
      details: command.slice(0, 50)
    };
  }
  
  // Block explicit side-effect tools
  if (isSideEffectTool(toolName)) {
    return { 
      blocked: true, 
      reason: 'side_effect_blocked',
      details: toolName
    };
  }
  
  // Task/subagent tools - allow but they'll be wrapped with Phase 0 too
  if (toolName === 'task') {
    return { blocked: false };
  }
  
  // Default: allow unknown tools (fail open for extensibility)
  // This is a conscious tradeoff - we don't want to break new tools
  debugLog(`Phase 0: Unknown tool '${toolName}' - allowing (fail open)`);
  return { blocked: false };
}

/**
 * Create the Phase 0 blocking message - natural language, not technical jargon
 * 
 * This message is shown to the agent when it tries to use a blocked tool.
 * In production (debug=false), the agent should respond naturally.
 */
export function createPhase0BlockMessage(_reason?: string, _details?: string): string {
  return `I need to understand the context first before making changes. Let me read the relevant files and confirm my understanding.`;
}
