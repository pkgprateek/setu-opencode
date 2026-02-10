/**
 * Context storage for Setu
 * 
 * Manages the .setu/ directory:
 * - .setu/context.json (machine-parseable, compact format)
 * - .setu/verification.log (audit trail)
 * 
 * Note: We no longer generate .setu/context.md - AGENTS.md serves as the human-readable version.
 * 
 * Re-exports ensureSetuDir from feedback.ts for consistency.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, statSync, renameSync, unlinkSync, openSync, fsyncSync, closeSync } from 'fs';
import { join, relative } from 'path';
import {
  type SetuContext,
  type FileRead,
  type SearchPerformed,
  type ObservedPattern,
  createEmptyContext
} from './types';
import { ensureSetuDir } from './feedback';
import { debugLog, errorLog } from '../debug';
import { debounce, CONTEXT_SAVE_DEBOUNCE_MS, sanitizeInput } from '../utils';
import { 
  MAX_CONTEXT_SIZE, 
  MAX_FILES_READ, 
  MAX_SEARCHES 
} from './limits';

// Re-export for convenience
export { ensureSetuDir };
// Re-export limits for backward compatibility
export { MAX_INJECTION_SIZE } from './limits';

const CONTEXT_JSON = 'context.json';
const VERIFICATION_LOG = 'verification.log';
const EXECUTION_LOG = 'execution.log';


// Log rotation settings (from PLAN.md Section 2.9.4)
const MAX_LOG_SIZE = 1024 * 1024;    // 1MB
const MAX_LOG_FILES = 3;

/**
 * Load the Setu context stored at `.setu/context.json` inside the given project directory.
 *
 * @param projectDir - The project root directory to look up `.setu/context.json`
 * @returns `SetuContext` if the file exists and parses successfully, `null` otherwise
 */
export function loadContext(projectDir: string): SetuContext | null {
  const contextPath = join(projectDir, '.setu', CONTEXT_JSON);
  
  if (!existsSync(contextPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(contextPath, 'utf-8');
    return JSON.parse(content) as SetuContext;
  } catch (error) {
    errorLog('Failed to load context:', error);
    return null;
  }
}

/**
 * Save a SetuContext to `.setu/context.json`.
 * 
 * Security features (PLAN.md Section 2.9.1):
 * - Enforces MAX_CONTEXT_SIZE (50KB) to prevent token bloat
 * - Validates arrays before truncation
 * - Truncates filesRead and searchesPerformed arrays if too large
 * - Uses compact JSON by default
 * - Never writes content larger than MAX_CONTEXT_SIZE
 * - Uses atomic write (temp file + rename) to prevent corruption
 * 
 * @param projectDir - Project root directory
 * @param context - The context to save
 */
export function saveContext(projectDir: string, context: SetuContext): void {
  try {
    const setuDir = ensureSetuDir(projectDir);
    
    // Update timestamp
    context.updatedAt = new Date().toISOString();
    
    // DEFENSIVE: Validate arrays before slicing (corrupted state could have non-arrays)
    if (!Array.isArray(context.filesRead)) {
      debugLog('saveContext: filesRead was not an array, resetting to []');
      context.filesRead = [];
    }
    if (!Array.isArray(context.searchesPerformed)) {
      debugLog('saveContext: searchesPerformed was not an array, resetting to []');
      context.searchesPerformed = [];
    }
    
    // Track if initial serialization failed - prevents re-stringifying broken object
    let serializationFailed = false;
    let jsonContent: string;
    
    // Build a safe object for fallback scenarios
    const buildMinimalContext = (note: string): Record<string, unknown> => ({
      summary: typeof context.summary === 'string' ? context.summary.slice(0, 1000) : '[truncated]',
      filesRead: [],
      searchesPerformed: [],
      patterns: [],
      project: context.project ?? {},
      confirmed: context.confirmed ?? false,
      createdAt: context.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      note
    });
    
    // First attempt at serialization
    try {
      jsonContent = JSON.stringify(context);
    } catch (serializeError) {
      // Serialization failed (circular refs, BigInt, etc.) - use minimal safe object
      errorLog('saveContext: JSON.stringify failed, using minimal fallback:', serializeError);
      serializationFailed = true;
      jsonContent = JSON.stringify(buildMinimalContext('[truncated due to serialization error]'));
    }
    
    // Check size limit and truncate if needed (PLAN.md 2.9.1)
    // Only attempt re-serialization if initial serialization succeeded
    if (jsonContent.length > MAX_CONTEXT_SIZE && !serializationFailed) {
      debugLog(`Context size ${jsonContent.length} exceeds ${MAX_CONTEXT_SIZE}, truncating...`);
      
      // Truncate arrays to most recent entries
      context.filesRead = context.filesRead.slice(-MAX_FILES_READ);
      context.searchesPerformed = context.searchesPerformed.slice(-MAX_SEARCHES);
      
      // Retry serialization on the mutated context
      try {
        jsonContent = JSON.stringify(context);
      } catch {
        serializationFailed = true;
        jsonContent = JSON.stringify(buildMinimalContext('[truncated due to serialization error after array trim]'));
      }
      
      // If still too large and not failed, truncate summary
      if (jsonContent.length > MAX_CONTEXT_SIZE && context.summary && !serializationFailed) {
        const maxSummary = 1000;
        context.summary = context.summary.slice(0, maxSummary) + '... [truncated]';
        try {
          jsonContent = JSON.stringify(context);
        } catch {
          serializationFailed = true;
          jsonContent = JSON.stringify(buildMinimalContext('[truncated due to serialization error after summary trim]'));
        }
      }
      
      // LAST RESORT: If still too large, use minimal safe object
      if (jsonContent.length > MAX_CONTEXT_SIZE) {
        debugLog('saveContext: Still too large after truncation, using minimal fallback');
        jsonContent = JSON.stringify(buildMinimalContext('[truncated due to size limit]'));
      }
    }
    
    // Write JSON - compact by default, pretty in debug mode
    const jsonPath = join(setuDir, CONTEXT_JSON);
    const isDebug = process.env.SETU_DEBUG === 'true';
    
    // Determine final content - pretty print in debug, but enforce size limit
    // IMPORTANT: Pretty-print from jsonContent (already chosen/truncated), not raw context
    let finalContent = jsonContent;
    if (isDebug) {
      try {
        // Parse the already-chosen jsonContent and re-stringify with formatting
        // This ensures consistency with truncated/minimalContext choice
        const parsedContent = JSON.parse(jsonContent);
        const prettyContent = JSON.stringify(parsedContent, null, 2);
        // Only use pretty if it fits within limit
        if (prettyContent.length <= MAX_CONTEXT_SIZE) {
          finalContent = prettyContent;
        }
      } catch {
        // Parse/pretty print failed, stick with compact jsonContent
        debugLog('saveContext: Pretty print failed, using compact format');
      }
    }
    
    // FINAL GUARD: Never write content larger than MAX_CONTEXT_SIZE
    if (finalContent.length > MAX_CONTEXT_SIZE) {
      finalContent = jsonContent; // Fall back to compact
    }
    
    // ATOMIC WRITE: Write to temp file, fsync, then rename
    // This prevents concurrent write interleaving and partial-file corruption
    const tempPath = `${jsonPath}.${process.pid}.tmp`;
    try {
      // Write to temp file
      writeFileSync(tempPath, finalContent, 'utf-8');
      
      // Fsync to ensure data is flushed to disk
      const fd = openSync(tempPath, 'r+');
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      
      // Atomic rename (replaces original atomically on POSIX systems)
      renameSync(tempPath, jsonPath);
      
      debugLog('Context saved to .setu/context.json (atomic write)');
    } catch (writeError) {
      // Clean up temp file if it exists
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw writeError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    // Log but don't throw - context save failure shouldn't crash the plugin
    errorLog('saveContext failed:', error);
  }
}

/**
 * In-memory context collector for the current session
 * 
 * Tracks reads/searches during Phase 0, then persists on confirmation.
 */
export interface ContextCollector {
  /** Get the current in-memory context */
  getContext: () => SetuContext;
  
  /** Record a file read */
  recordFileRead: (filePath: string, summary?: string) => void;
  
  /** Record a search/grep */
  recordSearch: (pattern: string, tool: 'grep' | 'glob', resultCount: number) => void;
  
  /** Add an observed pattern */
  addPattern: (pattern: ObservedPattern) => void;
  
  /** Update project info */
  updateProjectInfo: (info: Partial<SetuContext['project']>) => void;
  
  /** Confirm context with summary and plan */
  confirm: (summary: string, currentTask: string, plan?: string) => void;
  
  /** Reset to empty context */
  reset: () => void;
  
  /** Load from disk if available */
  loadFromDisk: () => boolean;
  
  /** Save to disk */
  saveToDisk: () => void;
  
  /** Save to disk (debounced) - batches rapid writes within 100ms window */
  debouncedSave: () => void;
}

/**
 * Creates a context collector bound to the given project directory.
 *
 * @param projectDir - The project root directory used to compute relative file paths and locate on-disk context
 * @returns A ContextCollector for recording, updating, and persisting Setu context for the project
 */
export function createContextCollector(projectDir: string): ContextCollector {
  let context: SetuContext = createEmptyContext();
  
  // Helper to get relative path
  const toRelativePath = (filePath: string): string => {
    if (filePath.startsWith(projectDir)) {
      return relative(projectDir, filePath);
    }
    return filePath;
  };
  
  // Create debounced save function once (reused across all calls)
  const debouncedSaveFn = debounce(() => {
    saveContext(projectDir, context);
    debugLog('Context: Debounced save completed');
  }, CONTEXT_SAVE_DEBOUNCE_MS);
  
  return {
    getContext: () => context,
    
    recordFileRead: (filePath: string, summary?: string) => {
      const relativePath = toRelativePath(filePath);
      
      // Avoid duplicates
      if (!context.filesRead.some(f => f.path === relativePath)) {
        const fileRead: FileRead = {
          path: relativePath,
          readAt: new Date().toISOString(),
          summary
        };
        context.filesRead.push(fileRead);
        context.updatedAt = new Date().toISOString();
      }
    },
    
    recordSearch: (pattern: string, tool: 'grep' | 'glob', resultCount: number) => {
      const search: SearchPerformed = {
        pattern,
        tool,
        resultCount,
        searchedAt: new Date().toISOString()
      };
      context.searchesPerformed.push(search);
      context.updatedAt = new Date().toISOString();
    },
    
    addPattern: (pattern: ObservedPattern) => {
      // Avoid duplicates by name
      if (!context.patterns.some(p => p.name === pattern.name)) {
        context.patterns.push(pattern);
        context.updatedAt = new Date().toISOString();
      }
    },
    
    updateProjectInfo: (info: Partial<SetuContext['project']>) => {
      context.project = { ...context.project, ...info };
      context.updatedAt = new Date().toISOString();
    },
    
    confirm: (summary: string, currentTask: string, plan?: string) => {
      context.confirmed = true;
      context.confirmedAt = new Date().toISOString();
      context.summary = summary;
      context.currentTask = currentTask;
      context.plan = plan;
      context.updatedAt = new Date().toISOString();
    },
    
    reset: () => {
      // Cancel any pending debounced save to prevent stale writes
      debouncedSaveFn.cancel();
      context = createEmptyContext();
    },
    
    loadFromDisk: (): boolean => {
      const loaded = loadContext(projectDir);
      if (loaded) {
        context = loaded;
        debugLog('Loaded existing context from .setu/context.json');
        return true;
      }
      return false;
    },
    
    saveToDisk: () => {
      saveContext(projectDir, context);
    },
    
    debouncedSave: debouncedSaveFn
  };
}

/**
 * Rotate log file when it exceeds MAX_LOG_SIZE.
 * 
 * Rotation scheme (PLAN.md Section 2.9.4):
 * - verification.log.2 → delete
 * - verification.log.1 → verification.log.2
 * - verification.log → verification.log.1
 * 
 * @param logPath - Path to the log file
 */
function rotateLog(logPath: string): void {
  try {
    // Rotate from oldest to newest
    // With MAX_LOG_FILES=3: delete .2, rename .1→.2
    // Then separately rename current log → .1
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      // Always use numbered files in the loop
      // The current (unnumbered) log is handled separately below
      const from = `${logPath}.${i}`;
      const to = `${logPath}.${i + 1}`;

      try {
        if (i === MAX_LOG_FILES - 1) {
          // Delete the oldest file (e.g., .2 when MAX_LOG_FILES=3)
          unlinkSync(from);
        } else {
          // Rename to next number (e.g., .1 → .2)
          renameSync(from, to);
        }
      } catch (err: unknown) {
        // Only ignore ENOENT (file not found) - other errors should be logged
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
          debugLog(`Log rotation error (${from}):`, err);
        }
        // File may not exist or already rotated - continue
      }
    }
    
    // Rename current log to .1
    try {
      renameSync(logPath, `${logPath}.1`);
    } catch (err: unknown) {
      // Only ignore ENOENT - other errors should be logged
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        debugLog(`Log rotation rename error:`, err);
      }
      // File may not exist or already rotated
    }
    
    debugLog('Log rotated successfully');
  } catch (error) {
    // Log rotation failure is non-critical
    debugLog('Log rotation failed:', error);
  }
}

/**
 * Record a verification step result in .setu/verification.log.
 *
 * Security features (PLAN.md Section 2.9.4):
 * - Rotates log when it exceeds MAX_LOG_SIZE (1MB)
 * - Keeps MAX_LOG_FILES (3) rotated logs
 * 
 * Creates the log file with a header if missing and appends a timestamped entry
 * containing the step name, PASS/FAIL status, and optional command output.
 *
 * @param projectDir - Project root directory containing (or to create) the .setu directory
 * @param step - The verification step name (e.g., "build", "test", "lint")
 * @param success - `true` if the step passed, `false` if it failed
 * @param output - Optional command output to include; truncated to 500 characters if longer
 */
export function logVerification(
  projectDir: string,
  step: string,
  success: boolean,
  output?: string
): void {
  const setuDir = ensureSetuDir(projectDir);
  const logPath = join(setuDir, VERIFICATION_LOG);
  
  // Check if rotation needed (PLAN.md 2.9.4)
  if (existsSync(logPath)) {
    try {
      const stats = statSync(logPath);
      if (stats.size > MAX_LOG_SIZE) {
        rotateLog(logPath);
      }
    } catch {
      // Ignore stat errors
    }
  }
  
  const timestamp = new Date().toISOString();
  const status = success ? 'PASS' : 'FAIL';
  
  // Sanitize inputs to prevent log injection attacks
  const safeStep = String(sanitizeInput(step));
  const safeOutput = output ? String(sanitizeInput(output)) : undefined;
  
  let entry = `\n## ${timestamp} - ${safeStep.toUpperCase()} [${status}]\n`;
  
  if (safeOutput) {
    // Truncate long output
    const truncated = safeOutput.length > 500 
      ? safeOutput.slice(0, 500) + '\n... (truncated)'
      : safeOutput;
    entry += `\n\`\`\`\n${truncated}\n\`\`\`\n`;
  }
  
  // Create file with header if it doesn't exist
  if (!existsSync(logPath)) {
    writeFileSync(logPath, '# Setu Verification Log\n\nAudit trail of build/test/lint results.\n', 'utf-8');
  }
  
  appendFileSync(logPath, entry, 'utf-8');
}

export function logExecutionPhase(
  projectDir: string,
  phase: string,
  event: 'enter' | 'complete' | 'blocked',
  detail?: string
): void {
  const setuDir = ensureSetuDir(projectDir);
  const logPath = join(setuDir, EXECUTION_LOG);

  if (existsSync(logPath)) {
    try {
      const stats = statSync(logPath);
      if (stats.size > MAX_LOG_SIZE) {
        rotateLog(logPath);
      }
    } catch {
      // Ignore stat errors
    }
  }

  if (!existsSync(logPath)) {
    writeFileSync(logPath, '# Setu Execution Log\n\nChronological protocol events.\n', 'utf-8');
  }

  const timestamp = new Date().toISOString();
  const safePhase = String(sanitizeInput(phase));
  const safeEvent = String(sanitizeInput(event));
  const safeDetail = detail ? String(sanitizeInput(detail)) : '';
  const line = `\n- ${timestamp} | phase=${safePhase} | event=${safeEvent}${safeDetail ? ` | detail=${safeDetail}` : ''}`;
  appendFileSync(logPath, line, 'utf-8');
}

/**
 * Infer project metadata (type, runtime, build tool, test framework, and frameworks) by inspecting common project files in the given directory.
 *
 * @param projectDir - Project root directory to inspect
 * @returns An object containing detected fields such as `type`, `runtime`, `buildTool`, `testFramework`, and `frameworks` when identifiable
 */
export function detectProjectInfo(projectDir: string): SetuContext['project'] {
  const project: SetuContext['project'] = {};
  
  // Check for package.json (Node.js/JavaScript/TypeScript)
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      
      // Detect runtime
      if (pkg.devDependencies?.['bun-types'] || existsSync(join(projectDir, 'bun.lockb'))) {
        project.runtime = 'bun';
      } else if (existsSync(join(projectDir, 'deno.json')) || existsSync(join(projectDir, 'deno.jsonc'))) {
        project.runtime = 'deno';
      } else {
        project.runtime = 'node';
      }
      
      // Detect type
      if (pkg.devDependencies?.typescript || existsSync(join(projectDir, 'tsconfig.json'))) {
        project.type = 'typescript';
      } else {
        project.type = 'javascript';
      }
      
      // Detect build tool
      if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) {
        project.buildTool = 'pnpm';
      } else if (existsSync(join(projectDir, 'yarn.lock'))) {
        project.buildTool = 'yarn';
      } else if (existsSync(join(projectDir, 'bun.lockb'))) {
        project.buildTool = 'bun';
      } else if (existsSync(join(projectDir, 'package-lock.json'))) {
        project.buildTool = 'npm';
      }
      
      // Detect test framework
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) project.testFramework = 'vitest';
      else if (deps.jest) project.testFramework = 'jest';
      else if (deps.mocha) project.testFramework = 'mocha';
      else if (deps.ava) project.testFramework = 'ava';
      
      // Detect frameworks
      const frameworks: string[] = [];
      if (deps.react) frameworks.push('react');
      if (deps.vue) frameworks.push('vue');
      if (deps.svelte) frameworks.push('svelte');
      if (deps.express) frameworks.push('express');
      if (deps.fastify) frameworks.push('fastify');
      if (deps.next) frameworks.push('next');
      if (deps.nuxt) frameworks.push('nuxt');
      if (deps.hono) frameworks.push('hono');
      if (frameworks.length) project.frameworks = frameworks;
      
    } catch {
      // Ignore parse errors
    }
  }
  
  // Check for Cargo.toml (Rust)
  if (existsSync(join(projectDir, 'Cargo.toml'))) {
    project.type = 'rust';
    project.buildTool = 'cargo';
  }
  
  // Check for go.mod (Go)
  if (existsSync(join(projectDir, 'go.mod'))) {
    project.type = 'go';
    project.buildTool = 'go';
  }
  
  // Check for pyproject.toml or requirements.txt (Python)
  if (existsSync(join(projectDir, 'pyproject.toml'))) {
    project.type = 'python';
    project.buildTool = 'uv'; // Modern default
  } else if (existsSync(join(projectDir, 'requirements.txt'))) {
    project.type = 'python';
    project.buildTool = 'pip';
  }
  
  return project;
}
