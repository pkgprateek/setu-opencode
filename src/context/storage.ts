/**
 * Context storage for Setu
 * 
 * Manages the .setu/ directory:
 * - .setu/context.md (human-readable)
 * - .setu/context.json (machine-parseable)
 * - .setu/verification.log (audit trail)
 * 
 * Re-exports ensureSetuDir from feedback.ts for consistency.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, relative } from 'path';
import {
  type SetuContext,
  type FileRead,
  type SearchPerformed,
  type ObservedPattern,
  createEmptyContext
} from './types';
import { ensureSetuDir } from './feedback';

// Re-export for convenience
export { ensureSetuDir };

const CONTEXT_JSON = 'context.json';
const CONTEXT_MD = 'context.md';
const VERIFICATION_LOG = 'verification.log';

/**
 * Loads existing context from .setu/context.json
 * 
 * @param projectDir - Project root directory
 * @returns The loaded context or null if not found
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
    console.error('[Setu] Failed to load context:', error);
    return null;
  }
}

/**
 * Saves context to .setu/context.json and .setu/context.md
 * 
 * @param projectDir - Project root directory
 * @param context - The context to save
 */
export function saveContext(projectDir: string, context: SetuContext): void {
  const setuDir = ensureSetuDir(projectDir);
  
  // Update timestamp
  context.updatedAt = new Date().toISOString();
  
  // Write JSON (machine-parseable)
  const jsonPath = join(setuDir, CONTEXT_JSON);
  writeFileSync(jsonPath, JSON.stringify(context, null, 2), 'utf-8');
  
  // Write Markdown (human-readable)
  const mdPath = join(setuDir, CONTEXT_MD);
  writeFileSync(mdPath, generateContextMarkdown(context), 'utf-8');
  
  console.log('[Setu] Context saved to .setu/');
}

/**
 * Generates human-readable markdown from context
 */
function generateContextMarkdown(context: SetuContext): string {
  const lines: string[] = [
    '# Setu Context',
    '',
    `> Last updated: ${context.updatedAt}`,
    `> Confirmed: ${context.confirmed ? `Yes (${context.confirmedAt})` : 'No'}`,
    ''
  ];
  
  // Summary
  if (context.summary) {
    lines.push('## Summary', '', context.summary, '');
  }
  
  // Current task
  if (context.currentTask) {
    lines.push('## Current Task', '', context.currentTask, '');
  }
  
  // Plan
  if (context.plan) {
    lines.push('## Plan', '', context.plan, '');
  }
  
  // Project info
  lines.push('## Project', '');
  if (context.project.type) lines.push(`- **Type:** ${context.project.type}`);
  if (context.project.runtime) lines.push(`- **Runtime:** ${context.project.runtime}`);
  if (context.project.buildTool) lines.push(`- **Build Tool:** ${context.project.buildTool}`);
  if (context.project.testFramework) lines.push(`- **Test Framework:** ${context.project.testFramework}`);
  if (context.project.frameworks?.length) {
    lines.push(`- **Frameworks:** ${context.project.frameworks.join(', ')}`);
  }
  lines.push('');
  
  // Files read
  if (context.filesRead.length > 0) {
    lines.push('## Files Read', '');
    for (const file of context.filesRead) {
      const summaryPart = file.summary ? ` - ${file.summary}` : '';
      lines.push(`- \`${file.path}\`${summaryPart}`);
    }
    lines.push('');
  }
  
  // Searches performed
  if (context.searchesPerformed.length > 0) {
    lines.push('## Searches Performed', '');
    for (const search of context.searchesPerformed) {
      lines.push(`- ${search.tool}: \`${search.pattern}\` (${search.resultCount} results)`);
    }
    lines.push('');
  }
  
  // Patterns observed
  if (context.patterns.length > 0) {
    lines.push('## Patterns Observed', '');
    for (const pattern of context.patterns) {
      lines.push(`### ${pattern.name}`, '', pattern.description);
      if (pattern.examples?.length) {
        lines.push('', 'Examples:');
        for (const example of pattern.examples) {
          lines.push(`- \`${example}\``);
        }
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
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
}

/**
 * Creates a context collector for a project
 * 
 * @param projectDir - Project root directory
 * @returns Context collector instance
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
      context = createEmptyContext();
    },
    
    loadFromDisk: (): boolean => {
      const loaded = loadContext(projectDir);
      if (loaded) {
        context = loaded;
        console.log('[Setu] Loaded existing context from .setu/context.json');
        return true;
      }
      return false;
    },
    
    saveToDisk: () => {
      saveContext(projectDir, context);
    }
  };
}

/**
 * Appends a verification result to the log
 * 
 * @param projectDir - Project root directory
 * @param step - The verification step (build, test, lint)
 * @param success - Whether the step passed
 * @param output - Output from the command (truncated)
 */
export function logVerification(
  projectDir: string,
  step: string,
  success: boolean,
  output?: string
): void {
  const setuDir = ensureSetuDir(projectDir);
  const logPath = join(setuDir, VERIFICATION_LOG);
  
  const timestamp = new Date().toISOString();
  const status = success ? 'PASS' : 'FAIL';
  
  let entry = `\n## ${timestamp} - ${step.toUpperCase()} [${status}]\n`;
  
  if (output) {
    // Truncate long output
    const truncated = output.length > 500 
      ? output.slice(0, 500) + '\n... (truncated)'
      : output;
    entry += `\n\`\`\`\n${truncated}\n\`\`\`\n`;
  }
  
  // Create file with header if it doesn't exist
  if (!existsSync(logPath)) {
    writeFileSync(logPath, '# Setu Verification Log\n\nAudit trail of build/test/lint results.\n', 'utf-8');
  }
  
  appendFileSync(logPath, entry, 'utf-8');
}

/**
 * Detects project info from common files
 * 
 * @param projectDir - Project root directory
 * @returns Detected project info
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
