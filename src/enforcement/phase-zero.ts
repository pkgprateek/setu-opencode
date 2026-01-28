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

/**
 * Setu's own tools - always allowed regardless of Phase 0 state
 * These are tools provided by this plugin
 */
const SETU_TOOLS = ['setu_verify', 'setu_context', 'setu_feedback'] as const;

/**
 * Read-only tools that are always allowed
 * These let the agent "look but don't touch"
 */
const READ_ONLY_TOOLS = ['read', 'glob', 'grep', 'webfetch', 'todoread'] as const;

/**
 * Bash commands that are read-only
 * Allow reconnaissance, block modification
 */
const READ_ONLY_BASH_COMMANDS = [
  'ls', 'cat', 'head', 'tail', 'grep', 'rg', 'find', 
  'pwd', 'echo', 'which', 'env', 'printenv',
  'git status', 'git log', 'git diff', 'git branch', 'git show',
  'file', 'stat', 'wc', 'tree', 'less', 'more'
] as const;

/**
 * Side-effect tools that are blocked in Phase 0
 */
const SIDE_EFFECT_TOOLS = ['write', 'edit', 'todowrite'] as const;

/**
 * Git write operations that are blocked
 */
const GIT_WRITE_COMMANDS = [
  'git add', 'git commit', 'git push', 'git pull', 'git merge',
  'git rebase', 'git reset', 'git checkout -b', 'git stash',
  'git cherry-pick', 'git revert', 'git tag', 'git branch -d',
  'git branch -D', 'git remote add', 'git remote remove'
] as const;

export interface Phase0State {
  /** Whether context has been confirmed by user response */
  contextConfirmed: boolean;
  /** Session ID for isolation */
  sessionId: string;
  /** Timestamp when Phase 0 started */
  startedAt: number;
}

/**
 * Check if a tool is one of Setu's own tools
 */
export function isSetuTool(toolName: string): boolean {
  return SETU_TOOLS.includes(toolName as typeof SETU_TOOLS[number]);
}

/**
 * Check if a tool is read-only and allowed during Phase 0
 */
export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.includes(toolName as typeof READ_ONLY_TOOLS[number]);
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
 * Determines whether a tool is considered a side-effect tool and should be blocked in Phase 0.
 *
 * @returns `true` if `toolName` is listed in `SIDE_EFFECT_TOOLS`, `false` otherwise.
 */
export function isSideEffectTool(toolName: string): boolean {
  return SIDE_EFFECT_TOOLS.includes(toolName as typeof SIDE_EFFECT_TOOLS[number]);
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
  console.log(`[Setu] Phase 0: Unknown tool '${toolName}' - allowing (fail open)`);
  return { blocked: false };
}

/**
 * Create the Phase 0 blocking message - short and clear
 */
export function createPhase0BlockMessage(_reason?: string, _details?: string): string {
  return `[Setu] Phase 0 active. Read files first, then call setu_context to proceed.`;
}