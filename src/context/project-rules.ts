/**
 * Project rules loader for Silent Exploration
 * 
 * On session start, automatically reads project documentation and context files:
 * - AGENTS.md: Project-specific coding rules
 * - CLAUDE.md: Legacy project rules (some projects use this)
 * - .setu/active.json: Current task and constraints
 * - .setu/context.json: Previous understanding
 * 
 * These are injected into the system prompt so Setu starts "informed"
 * rather than asking questions that documentation already answers.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { debugLog, errorLog } from '../debug';
import type { ActiveTask } from './types';

// Re-export for convenience
export type { ActiveTask };

/**
 * Project rules and context loaded on session start
 */
export interface ProjectRules {
  /** Content of AGENTS.md (project rules) */
  agentsMd?: string;
  /** Content of CLAUDE.md (legacy rules) */
  claudeMd?: string;
  /** Active task if in progress */
  activeTask?: ActiveTask;
  /** Summary from previous context */
  contextSummary?: string;
}

/**
 * Maximum file size to read (prevent loading huge files)
 */
const MAX_FILE_SIZE = 50000; // 50KB (~12,500 tokens)

/**
 * Read a file safely with size limits and error handling
 */
function readFileSafe(filePath: string, maxSize: number = MAX_FILE_SIZE): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Truncate if too large
    if (content.length > maxSize) {
      debugLog(`Truncated ${filePath} (${content.length} → ${maxSize} chars)`);
      return content.slice(0, maxSize) + '\n\n[... file truncated for token efficiency ...]';
    }
    
    return content;
  } catch (error) {
    errorLog(`Failed to read ${filePath}:`, error);
    return null;
  }
}

/**
 * Load all project rules synchronously on session start
 * 
 * Reads files in this priority order:
 * 1. AGENTS.md (project rules - highest priority)
 * 2. CLAUDE.md (legacy rules)
 * 3. .setu/active.json (current task)
 * 4. .setu/context.json (previous understanding)
 * 
 * @param projectDir - Project root directory
 * @returns ProjectRules object with loaded content
 */
export function loadProjectRules(projectDir: string): ProjectRules {
  const rules: ProjectRules = {};
  
  // 1. Load AGENTS.md (project rules)
  const agentsMdPath = join(projectDir, 'AGENTS.md');
  const agentsMdContent = readFileSafe(agentsMdPath);
  if (agentsMdContent) {
    rules.agentsMd = agentsMdContent;
    debugLog('Loaded AGENTS.md for silent exploration');
  }
  
  // 2. Load CLAUDE.md (legacy rules)
  const claudeMdPath = join(projectDir, 'CLAUDE.md');
  const claudeMdContent = readFileSafe(claudeMdPath);
  if (claudeMdContent) {
    rules.claudeMd = claudeMdContent;
    debugLog('Loaded CLAUDE.md for silent exploration');
  }
  
  // 3. Load .setu/active.json (current task)
  const activeJsonPath = join(projectDir, '.setu', 'active.json');
  const activeContent = readFileSafe(activeJsonPath, MAX_FILE_SIZE);
  if (activeContent) {
    try {
      const parsed = JSON.parse(activeContent);
      
      // Validate ActiveTask shape before using
      if (
        parsed &&
        typeof parsed.task === 'string' &&
        typeof parsed.mode === 'string' &&
        typeof parsed.status === 'string' &&
        Array.isArray(parsed.constraints)
      ) {
        rules.activeTask = parsed as ActiveTask;
        debugLog(`Loaded active task: ${parsed.task.slice(0, 50)}...`);
      } else {
        errorLog('Invalid active.json structure - missing required fields');
      }
    } catch (error) {
      errorLog('Failed to parse active.json:', error);
    }
  }
  
  // 4. Load .setu/context.json summary (previous understanding)
  // Note: Full context is loaded by ContextCollector, we just need summary for rules
  const contextJsonPath = join(projectDir, '.setu', 'context.json');
  if (existsSync(contextJsonPath)) {
    try {
      const content = readFileSync(contextJsonPath, 'utf-8');
      const context = JSON.parse(content);
      if (context.summary) {
        rules.contextSummary = context.summary;
        debugLog('Loaded context summary for silent exploration');
      }
    } catch (error) {
      errorLog('Failed to parse context.json:', error);
    }
  }
  
  return rules;
}

/**
 * Format project rules for injection into system prompt
 * 
 * Creates a structured block that tells the agent:
 * - What project rules exist
 * - What task is in progress (if any)
 * - What understanding already exists
 * 
 * @param rules - The loaded project rules
 * @returns Formatted string for system prompt injection
 */
export function formatRulesForInjection(rules: ProjectRules): string {
  const blocks: string[] = [];
  
  // Header
  blocks.push('[SILENT EXPLORATION - PROJECT CONTEXT PRELOADED]');
  
  // AGENTS.md rules
  if (rules.agentsMd) {
    blocks.push('');
    blocks.push('[PROJECT RULES - AGENTS.md]');
    blocks.push(rules.agentsMd);
  }
  
  // CLAUDE.md rules (if separate from AGENTS.md)
  if (rules.claudeMd) {
    blocks.push('');
    blocks.push('[PROJECT RULES - CLAUDE.md]');
    blocks.push(rules.claudeMd);
  }
  
  // Active task (CRITICAL - prevents going rogue after restart)
  if (rules.activeTask && rules.activeTask.status === 'in_progress') {
    blocks.push('');
    blocks.push('[RESUME TASK - CRITICAL]');
    blocks.push(`Task: ${rules.activeTask.task}`);
    blocks.push(`Mode: ${rules.activeTask.mode}`);
    if (Array.isArray(rules.activeTask.constraints) && rules.activeTask.constraints.length > 0) {
      blocks.push(`Constraints: ${rules.activeTask.constraints.join(', ')}`);
    }
    if (rules.activeTask.references && rules.activeTask.references.length > 0) {
      blocks.push(`References: ${rules.activeTask.references.join(', ')}`);
    }
    blocks.push(`Started: ${rules.activeTask.startedAt}`);
    blocks.push('');
    blocks.push('IMPORTANT: Resume this task. Do NOT start unrelated work.');
  }
  
  // Context summary (previous understanding)
  if (rules.contextSummary) {
    blocks.push('');
    blocks.push('[PREVIOUS UNDERSTANDING]');
    blocks.push(rules.contextSummary);
  }
  
  // Footer with guidance
  blocks.push('');
  blocks.push('[GUIDANCE]');
  blocks.push('You have been pre-loaded with project context via Silent Exploration.');
  blocks.push('Do NOT ask questions that these files already answer.');
  blocks.push('Do NOT re-read these files unless the user asks you to check for updates.');
  blocks.push('Use this knowledge to provide informed, context-aware responses from the start.');
  blocks.push('[/SILENT EXPLORATION]');
  
  return blocks.join('\n');
}

/**
 * Check if any project rules exist (for conditional injection)
 * 
 * @param rules - The loaded project rules
 * @returns true if any rules content exists
 */
export function hasProjectRules(rules: ProjectRules): boolean {
  return !!(
    rules.agentsMd ||
    rules.claudeMd ||
    rules.activeTask ||
    rules.contextSummary
  );
}
