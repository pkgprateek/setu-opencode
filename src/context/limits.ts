/**
 * Context size limits (shared module to avoid circular dependencies)
 * 
 * Shared module to break circular dependency between types.ts and storage.ts.
 * Defines context size limits to prevent token bloat and unbounded growth.
 */

/** Maximum size of context.json in bytes (50KB - prevents token bloat) */
export const MAX_CONTEXT_SIZE = 51200;

/** Maximum size of injected context in chars (~2000 tokens) */
export const MAX_INJECTION_SIZE = 8000;

/** Maximum number of files to track in filesRead array (200 for monorepos) */
export const MAX_FILES_READ = 200;

/** Maximum number of searches to track */
export const MAX_SEARCHES = 50;

/** Maximum number of learnings (worked/failed approaches) to track for ghost loop prevention */
export const MAX_LEARNINGS = 20;
