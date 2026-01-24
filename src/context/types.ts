/**
 * Context types for Setu
 * 
 * Defines the structure of context that is:
 * - Collected during Phase 0 (reconnaissance)
 * - Persisted to .setu/context.json
 * - Injected into subagent prompts
 * - Loaded on session start for continuity
 */

/**
 * Project metadata detected during context gathering
 */
export interface ProjectInfo {
  /** Project type (typescript, python, rust, go, etc.) */
  type?: string;
  /** Runtime (node, bun, deno, python, etc.) */
  runtime?: string;
  /** Build tool (npm, pnpm, yarn, bun, cargo, etc.) */
  buildTool?: string;
  /** Test framework if detected */
  testFramework?: string;
  /** Detected frameworks (react, express, fastify, etc.) */
  frameworks?: string[];
}

/**
 * A file that was read during Phase 0
 */
export interface FileRead {
  /** File path relative to project root */
  path: string;
  /** When the file was read */
  readAt: string;
  /** Brief description of what was learned (optional) */
  summary?: string;
}

/**
 * A search/grep that was performed during Phase 0
 */
export interface SearchPerformed {
  /** The pattern searched for */
  pattern: string;
  /** Tool used (grep, glob) */
  tool: 'grep' | 'glob';
  /** Number of results found */
  resultCount: number;
  /** When the search was performed */
  searchedAt: string;
}

/**
 * Patterns or conventions observed in the codebase
 */
export interface ObservedPattern {
  /** Pattern name */
  name: string;
  /** Description of the pattern */
  description: string;
  /** Example files where this pattern is seen */
  examples?: string[];
}

/**
 * The main context structure persisted to .setu/context.json
 */
export interface SetuContext {
  /** Version of the context schema */
  version: string;
  
  /** When context was first created */
  createdAt: string;
  
  /** When context was last updated */
  updatedAt: string;
  
  /** Whether context has been confirmed by the agent */
  confirmed: boolean;
  
  /** When context was confirmed (if confirmed) */
  confirmedAt?: string;
  
  /** Human-readable summary of understanding */
  summary?: string;
  
  /** Project metadata */
  project: ProjectInfo;
  
  /** Files read during Phase 0 */
  filesRead: FileRead[];
  
  /** Searches performed during Phase 0 */
  searchesPerformed: SearchPerformed[];
  
  /** Observed patterns in the codebase */
  patterns: ObservedPattern[];
  
  /** The user's current task/goal (from confirmation) */
  currentTask?: string;
  
  /** Agent's plan for the task (from confirmation) */
  plan?: string;
}

/**
 * Minimal context for injection into subagent prompts
 * 
 * This is a compressed version of SetuContext that fits
 * in a reasonable token budget for subagent prompts.
 */
export interface SetuContextSummary {
  /** Project type and runtime */
  project: string;
  /** Key files already read (no need to re-read) */
  filesRead: string[];
  /** Key patterns to follow */
  patterns: string[];
  /** Current task summary */
  task?: string;
}

/**
 * Create a new, empty SetuContext populated with initial metadata and timestamps.
 *
 * @returns A SetuContext initialized with version "1.0", current ISO timestamps for `createdAt` and `updatedAt`, `confirmed` set to `false`, an empty `project` object, and empty arrays for `filesRead`, `searchesPerformed`, and `patterns`.
 */
export function createEmptyContext(): SetuContext {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    confirmed: false,
    project: {},
    filesRead: [],
    searchesPerformed: [],
    patterns: []
  };
}

/**
 * Create a compact SetuContextSummary from a full SetuContext for prompt injection.
 *
 * @param context - The full persisted context to summarize
 * @returns A summary containing a human-readable `project` string, `filesRead` paths, `patterns` names, and optional `task`
 */
export function contextToSummary(context: SetuContext): SetuContextSummary {
  // Format project info
  const projectParts: string[] = [];
  if (context.project.type) projectParts.push(context.project.type);
  if (context.project.runtime) projectParts.push(`runtime: ${context.project.runtime}`);
  if (context.project.buildTool) projectParts.push(`build: ${context.project.buildTool}`);
  if (context.project.frameworks?.length) {
    projectParts.push(`frameworks: ${context.project.frameworks.join(', ')}`);
  }
  
  return {
    project: projectParts.join(', ') || 'unknown',
    filesRead: context.filesRead.map(f => f.path),
    patterns: context.patterns.map(p => p.name),
    task: context.currentTask
  };
}

/**
 * Format a SetuContextSummary into a multi-line block suitable for prompt injection.
 *
 * @param summary - The compact context summary to include in the formatted block
 * @returns The formatted multi-line string enclosed by "[SETU CONTEXT]" and "[/SETU CONTEXT]". Includes a "Project: ..." line, an optional "Files already read: ..." line listing up to 10 file paths (with " (+N more)" if truncated), an optional "Patterns: ..." line, and an optional "Task: ..." line.
 */
export function formatContextForInjection(summary: SetuContextSummary): string {
  const lines: string[] = [
    '[SETU CONTEXT]',
    `Project: ${summary.project}`
  ];
  
  if (summary.filesRead.length > 0) {
    lines.push(`Files already read: ${summary.filesRead.slice(0, 10).join(', ')}${summary.filesRead.length > 10 ? ` (+${summary.filesRead.length - 10} more)` : ''}`);
  }
  
  if (summary.patterns.length > 0) {
    lines.push(`Patterns: ${summary.patterns.join(', ')}`);
  }
  
  if (summary.task) {
    lines.push(`Task: ${summary.task}`);
  }
  
  lines.push('[/SETU CONTEXT]');
  
  return lines.join('\n');
}