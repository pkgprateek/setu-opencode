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
export const SETU_TOOLS = ['setu_verify', 'setu_context', 'setu_feedback'] as const;

/**
 * Read-only tools that are always allowed during Phase 0.
 * These let the agent "look but don't touch".
 * 
 * This is the single source of truth for parallelizable read-only tools.
 */
export const READ_ONLY_TOOLS = ['read', 'glob', 'grep', 'webfetch', 'todoread'] as const;

/**
 * Side-effect tools that are blocked in Phase 0.
 * These can modify files or state.
 */
export const SIDE_EFFECT_TOOLS = ['write', 'edit', 'todowrite'] as const;

/**
 * Bash commands that are read-only (exploration allowed).
 */
export const READ_ONLY_BASH_COMMANDS = [
  'glob', 'ls', 'cat', 'head', 'tail', 'grep', 'rg', 'find',
  'pwd', 'echo', 'which', 'env', 'printenv',
  'git status', 'git log', 'git diff', 'git branch', 'git show',
  'file', 'stat', 'wc', 'tree', 'less', 'more'
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
export function isReadOnlyToolName(toolName: string): toolName is ReadOnlyTool {
  return READ_ONLY_TOOLS.includes(toolName as ReadOnlyTool);
}

/**
 * Type guard to check if a tool is a side-effect tool
 */
export function isSideEffectTool(toolName: string): toolName is SideEffectTool {
  return SIDE_EFFECT_TOOLS.includes(toolName as SideEffectTool);
}

// ============================================================================
// Timing Constants
// ============================================================================

/** Time window (ms) for grouping parallel tool calls into a single batch */
export const PARALLEL_BATCH_WINDOW_MS = 100;

/** Cache TTL (ms) for file existence checks */
export const FILE_CACHE_TTL_MS = 5000;

// ============================================================================
// Magic Command Patterns
// ============================================================================

/**
 * Prefix commands (vim/slack style)
 * Format: `:style` at the start of a message
 * 
 * Why colon (:)?
 * - Evokes "command mode" (vim/slack)
 * - Distinct from shell ($) or paths (/)
 */
export const COMMAND_PREFIX = ':' as const;

/**
 * Valid style names for magic commands
 */
export const VALID_STYLES = ['ultrathink', 'quick', 'expert', 'collab'] as const;

/**
 * Aliases for style names (shorthand convenience)
 */
export const STYLE_ALIASES: Record<string, typeof VALID_STYLES[number]> = {
  // Ultrathink aliases
  'default': 'ultrathink',
  'full': 'ultrathink',
  'think': 'ultrathink',
  
  // Quick aliases
  'fast': 'quick',
  'q': 'quick',
  
  // Expert aliases
  'trust': 'expert',
  'x': 'expert',
  
  // Collab aliases
  'discuss': 'collab',
  'collaborate': 'collab',
} as const;

/**
 * Key-value prefixes for natural language style changes
 * Supports: "style: quick", "mode: quick", "preset: quick"
 */
export const KEY_VALUE_PREFIXES = ['style', 'mode', 'preset'] as const;
