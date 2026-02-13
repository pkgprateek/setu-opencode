/**
 * Hydration Gate: Pre-emptive Context Gate
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
 *
 * Security (fail-closed model):
 * - FAIL-CLOSED for unknown tools (block by default, whitelist safe tools)
 * - This prevents new/unknown tools from bypassing hydration safeguards
 *
 * Tool classification imported from constants.ts (single source of truth).
 * This module provides hydration-specific logic: blocking decisions, bash command parsing.
 */

import {
  READ_ONLY_BASH_COMMANDS,
  SIDE_EFFECT_TOOLS,
  GIT_WRITE_COMMANDS,
  isSetuTool,
  isReadOnlyTool,
} from "../constants";
import { debugLog } from "../debug";

// Re-export type guards for consumers of this module
export { isSetuTool, isReadOnlyTool };

export interface HydrationState {
  /** Whether context has been confirmed by user response */
  contextConfirmed: boolean;
  /** Session ID for isolation */
  sessionId: string;
  /** Timestamp when hydration started */
  startedAt: number;
}

/**
 * Check if a bash command is read-only
 *
 * @param command - The full bash command string
 * @returns true if the command is read-only
 */
export function isReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;

  // Reject control/null bytes to prevent parser confusion/bypass.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: security validation
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false;
  }

  // SECURITY: reject shell metacharacters and multiline/continued commands.
  // Fail-closed: hydration allows only single simple read-only commands.
  const dangerousPattern = /(;|&&|\|\||\||`|\$\(|>|>>|2>|>&|>\||<|&|\(|\)|\n|\r|\\\n)/;
  if (dangerousPattern.test(trimmed)) {
    return false;
  }

  // Check for git write commands first (they start with git)
  for (const gitCmd of GIT_WRITE_COMMANDS) {
    if (trimmed.startsWith(gitCmd)) {
      return false;
    }
  }

  // Get the first word/command
  const words = trimmed.split(/\s+/);
  const firstWord = words[0];

  // Check if it's a read-only command
  if (
    READ_ONLY_BASH_COMMANDS.includes(
      firstWord as (typeof READ_ONLY_BASH_COMMANDS)[number],
    )
  ) {
    return true;
  }

  // Check compound commands (e.g., "git status")
  const firstTwoWords = words.slice(0, 2).join(" ");
  if (
    READ_ONLY_BASH_COMMANDS.includes(
      firstTwoWords as (typeof READ_ONLY_BASH_COMMANDS)[number],
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Hydration enforcement logic
 *
 * Allow exploration, block modification
 *
 * Blocks side-effect tools until context is confirmed via setu_context.
 * Allows read-only tools so the agent can form smart questions.
 */
export function isSideEffectTool(toolName: string): boolean {
  return SIDE_EFFECT_TOOLS.includes(
    toolName as (typeof SIDE_EFFECT_TOOLS)[number],
  );
}

/**
 * Result of hydration blocking check
 */
export interface HydrationBlockResult {
  blocked: boolean;
  reason?: string;
  details?: string;
}

/**
 * Known safe tools that are always allowed during hydration.
 * 
 * FAIL-CLOSED SECURITY:
 * Unknown tools are blocked by default. Add tools here to whitelist them.
 * This prevents new/unknown tools from bypassing hydration safeguards.
 * 
 * NOTE: Only READ-ONLY tools should be here. Side-effect tools must go through
 * isSideEffectTool check to be blocked during hydration.
 */
const KNOWN_SAFE_TOOLS = [
  // Setu tools (via isSetuTool check)
  // Read-only tools (via isReadOnlyTool check)
  'task',        // Subagent spawning - will get its own hydration gating
  'question',    // Interactive prompts
  'skill',       // Skill loading
  'lsp',         // Language server
  'todoread',    // Todo list reading (read-only)
  // NOTE: todowrite is intentionally NOT here - it's a side-effect tool
] as const;

/**
 * Check if a tool is in the known safe list
 */
function isKnownSafeTool(toolName: string): boolean {
  return (KNOWN_SAFE_TOOLS as readonly string[]).includes(toolName);
}

/**
 * Decide whether a tool invocation should be blocked by hydration safeguards.
 * 
 * SECURITY: Uses FAIL-CLOSED model — unknown tools blocked by default.
 * Unknown tools are blocked by default and must be whitelisted.
 *
 * @param toolName - Name of the tool being invoked
 * @param args - Optional tool arguments; for `bash` the `command` string is examined to determine read-only status
 * @returns A HydrationBlockResult: `blocked` is `true` when the call should be prevented; `reason` is a block code (e.g., `bash_blocked`, `side_effect_blocked`) and `details` contains contextual information when available
 */
export function shouldBlockDuringHydration(
  toolName: string,
  args?: Record<string, unknown>,
): HydrationBlockResult {
  // Setu's own tools - always allowed
  if (isSetuTool(toolName)) {
    return { blocked: false };
  }

  // Always allow read-only tools
  if (isReadOnlyTool(toolName)) {
    return { blocked: false };
  }
  
  // Known safe tools - allowed
  if (isKnownSafeTool(toolName)) {
    return { blocked: false };
  }

  // Check bash commands
  if (toolName === "bash") {
    const rawCommand = args?.command;
    if (typeof rawCommand !== 'string') {
      return {
        blocked: true,
        reason: 'invalid_command_type',
        details: typeof rawCommand,
      };
    }

    const command = rawCommand;
    if (isReadOnlyBashCommand(command)) {
      return { blocked: false };
    }
    return {
      blocked: true,
      reason: "bash_blocked",
      details: command.slice(0, 50),
    };
  }

  // Block explicit side-effect tools
  if (isSideEffectTool(toolName)) {
    return {
      blocked: true,
      reason: "side_effect_blocked",
      details: toolName,
    };
  }

  // FAIL-CLOSED: Block unknown tools (prevents bypass via new/unrecognized tools)
  // Log warning to help identify tools that should be whitelisted
  debugLog(`Unknown tool '${toolName}' - blocking by default (fail-closed). Add to KNOWN_SAFE_TOOLS if safe.`);
  return {
    blocked: true,
    reason: "unknown_tool",
    details: `Tool '${toolName}' not recognized. Add to KNOWN_SAFE_TOOLS if it's a safe tool.`,
  };
}

/**
 * Create the hydration blocking message - natural language, not technical jargon
 *
 * This message is shown to the agent when it tries to use a blocked tool.
 * For common bash commands, suggest native alternatives with brief explanation.
 */
export function createHydrationBlockMessage(
  reason?: string,
): string {
  if (reason === 'unknown_tool') {
    return 'Wait: Call setu_context({ summary: "...", task: "..." }) first to confirm understanding.';
  }

  if (reason === 'bash_blocked') {
    return 'Wait: Call setu_context({ summary: "...", task: "..." }) first, then explore with read/search.';
  }

  return 'Wait: Call setu_context({ summary: "...", task: "..." }) first to confirm understanding.';
}
