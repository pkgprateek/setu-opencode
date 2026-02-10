/**
 * Setu Constants - Single Source of Truth
 * 
 * All tool classifications and constants are defined here.
 * Other modules import from this file to ensure consistency.
 * 
 * Design principle: Define once, derive types, use everywhere.
 */

// ============================================================================
// Tool Classifications
// ============================================================================

/**
 * Setu's own tools - always allowed regardless of Phase 0 state
 * These are tools provided by this plugin
 */
export const SETU_TOOLS = [
  'setu_verify',
  'setu_context',
  'setu_feedback',
  'setu_research',
  'setu_plan',
  'setu_reset',
  'setu_doctor'
] as const;

/**
 * Read-only tools that are always allowed during Phase 0.
 * These let the agent "look but don't touch".
 * 
 * This is the single source of truth for parallelizable read-only tools.
 * 
 * Includes:
 * - read: Read file contents
 * - glob: Find files by pattern
 * - grep: Search file contents
 * - list: Directory tree (OpenCode native, faster than bash ls)
 * - webfetch: Fetch web content
 * - todoread: Read todo list
 */
export const READ_ONLY_TOOLS = ['read', 'glob', 'grep', 'list', 'webfetch', 'todoread'] as const;

/**
 * Side-effect tools that are blocked in Phase 0.
 * These can modify files or state.
 * 
 * Includes OpenCode native tools that write or modify:
 * - write: Create/overwrite files
 * - edit: Modify existing files
 * - patch: Apply patches to files
 * - multiedit: Batch edits across files
 * - todowrite: Modify todo list
 */
export const SIDE_EFFECT_TOOLS = ['write', 'edit', 'patch', 'multiedit', 'todowrite'] as const;

/**
 * All tools that should be blocked in Phase 0 (for prompt guidance).
 * Combines SIDE_EFFECT_TOOLS with 'bash' which requires special handling.
 */
export const BLOCKED_TOOLS = [...SIDE_EFFECT_TOOLS, 'bash'] as const;

/**
 * Bash commands that are read-only (exploration allowed).
 * 
 * Strictly matches the Phase 0 allowlist from AGENTS.md:
 * - Basic file viewing: cat, head, tail, grep, find
 * - Environment info: pwd, echo, which, env
 * - Git read-only: git status, git log, git diff, git branch, git show
 * 
 * Note: 'ls' is intentionally excluded — use glob or list tools instead.
 * This enforces efficient tool usage and avoids shell spawning overhead.
 */
export const READ_ONLY_BASH_COMMANDS = [
  'cat', 'head', 'tail', 'grep', 'find',
  'pwd', 'echo', 'which', 'env',
  'git status', 'git log', 'git diff', 'git branch', 'git show'
] as const;

/**
 * Git write operations that are blocked in Phase 0.
 */
export const GIT_WRITE_COMMANDS = [
  'git add', 'git commit', 'git push', 'git pull', 'git merge',
  'git rebase', 'git reset', 'git checkout -b', 'git stash',
  'git cherry-pick', 'git revert', 'git tag', 'git branch -d',
  'git branch -D', 'git remote add', 'git remote remove'
] as const;

/**
 * Protected branch names that warrant extra caution
 */
export const PROTECTED_BRANCHES = ['main', 'master', 'production', 'prod'] as const;

// ============================================================================
// Derived Types (for type safety)
// ============================================================================

/** Type representing a Setu tool name */
export type SetuTool = typeof SETU_TOOLS[number];

/** Type representing a read-only tool name */
export type ReadOnlyTool = typeof READ_ONLY_TOOLS[number];

/** Type representing a side-effect tool name */
export type SideEffectTool = typeof SIDE_EFFECT_TOOLS[number];

/** Type representing a read-only bash command */
export type ReadOnlyBashCommand = typeof READ_ONLY_BASH_COMMANDS[number];

/** Type representing a git write command */
export type GitWriteCommand = typeof GIT_WRITE_COMMANDS[number];
export type ProtectedBranch = typeof PROTECTED_BRANCHES[number];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a tool is a Setu tool
 */
export function isSetuTool(toolName: string): toolName is SetuTool {
  return SETU_TOOLS.includes(toolName as SetuTool);
}

/**
 * Type guard to check if a tool is read-only
 */
export function isReadOnlyTool(toolName: string): toolName is ReadOnlyTool {
  return READ_ONLY_TOOLS.includes(toolName as ReadOnlyTool);
}

/**
 * @deprecated Use isReadOnlyTool instead
 */
export function isReadOnlyToolName(toolName: string): toolName is ReadOnlyTool {
  return isReadOnlyTool(toolName);
}

/**
 * Type guard to check if a tool is a side-effect tool
 */
export function isSideEffectTool(toolName: string): toolName is SideEffectTool {
  return SIDE_EFFECT_TOOLS.includes(toolName as SideEffectTool);
}

/**
 * Check if a branch name is protected
 */
export function isProtectedBranch(branch: string): boolean {
  return PROTECTED_BRANCHES.includes(branch.toLowerCase() as ProtectedBranch);
}

// ============================================================================
// Timing Constants
// ============================================================================

/** Time window (ms) for grouping parallel tool calls into a single batch */
export const PARALLEL_BATCH_WINDOW_MS = 100;

/** Cache TTL (ms) for file existence checks */
export const FILE_CACHE_TTL_MS = 5000;

// ============================================================================
// Runtime constants
// ============================================================================

// ============================================================================
// Rate Limits
// ============================================================================

/** Maximum feedback entries per session to prevent abuse */
export const MAX_FEEDBACK_PER_SESSION = 10;
