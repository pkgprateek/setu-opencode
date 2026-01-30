/**
 * Active Task Persistence
 * 
 * Manages .setu/active.json for tracking current task state:
 * - Task description and mode
 * - Constraints (READ_ONLY, NO_PUSH, etc.)
 * - Status (in_progress, completed, blocked)
 * 
 * Critical for:
 * - Surviving session restarts
 * - Surviving context compaction
 * - Enforcing constraints after memory loss
 */

import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { ensureSetuDir } from './storage';
import { type ActiveTask, type ConstraintType, type TaskStatus, CONSTRAINT_TYPES } from './types';
import { debugLog, errorLog } from '../debug';

// Re-export types for convenience
export type { ActiveTask, ConstraintType, TaskStatus };
export { CONSTRAINT_TYPES };

const ACTIVE_JSON = 'active.json';
const MAX_TASK_LENGTH = 500;       // Prevent bloated task descriptions
const MAX_REFERENCE_LENGTH = 200;  // Prevent long URLs
const MAX_REFERENCES = 10;         // Reasonable limit

/**
 * Sanitize a string for safe storage.
 * Trims whitespace and limits length.
 */
function sanitize(str: string, maxLength: number): string {
  return str.trim().slice(0, maxLength);
}

/**
 * Validate constraint type against known values.
 * Unknown constraints are filtered out for security.
 */
function isValidConstraint(value: unknown): value is ConstraintType {
  const validValues = Object.values(CONSTRAINT_TYPES);
  return typeof value === 'string' && validValues.includes(value as ConstraintType);
}

/**
 * Validate task status against known values.
 */
function isValidStatus(value: unknown): value is TaskStatus {
  return value === 'in_progress' || value === 'completed' || value === 'blocked';
}

/**
 * Load active task from .setu/active.json
 * 
 * Returns null if:
 * - File doesn't exist (normal case for new sessions)
 * - File is corrupted (graceful degradation)
 * - Validation fails (security measure)
 * 
 * @param projectDir - Project root directory
 * @returns ActiveTask or null
 */
export function loadActiveTask(projectDir: string): ActiveTask | null {
  const activeJsonPath = join(projectDir, '.setu', ACTIVE_JSON);
  
  if (!existsSync(activeJsonPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(activeJsonPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Validate required fields
    if (
      typeof parsed.task !== 'string' ||
      typeof parsed.mode !== 'string' ||
      typeof parsed.startedAt !== 'string' ||
      !isValidStatus(parsed.status) ||
      !Array.isArray(parsed.constraints)
    ) {
      errorLog('Invalid active.json structure - missing or invalid required fields');
      return null;
    }
    
    // Filter to valid constraints only (security: reject unknown constraints)
    const validConstraints = parsed.constraints.filter(isValidConstraint);
    
    // Build validated task
    const task: ActiveTask = {
      task: sanitize(parsed.task, MAX_TASK_LENGTH),
      mode: sanitize(parsed.mode, 50),
      constraints: validConstraints,
      startedAt: parsed.startedAt,
      status: parsed.status,
    };
    
    // Optional: references
    if (Array.isArray(parsed.references)) {
      task.references = parsed.references
        .filter((r: unknown): r is string => typeof r === 'string')
        .slice(0, MAX_REFERENCES)
        .map((r: string) => sanitize(r, MAX_REFERENCE_LENGTH));
    }
    
    debugLog(`Loaded active task: "${task.task.slice(0, 50)}..." [${task.status}]`);
    return task;
    
  } catch (error) {
    errorLog('Failed to parse active.json:', error);
    return null;
  }
}

/**
 * Save active task to .setu/active.json
 * 
 * Uses atomic write pattern:
 * 1. Write to .tmp file
 * 2. Rename to final path
 * 
 * This prevents corruption if write is interrupted.
 * 
 * @param projectDir - Project root directory
 * @param task - ActiveTask to save
 */
export function saveActiveTask(projectDir: string, task: ActiveTask): void {
  ensureSetuDir(projectDir);
  
  const activePath = join(projectDir, '.setu', ACTIVE_JSON);
  const tmpPath = activePath + '.tmp';
  
  try {
    // Sanitize before saving
    const sanitizedTask: ActiveTask = {
      task: sanitize(task.task, MAX_TASK_LENGTH),
      mode: sanitize(task.mode, 50),
      constraints: task.constraints.filter(isValidConstraint),
      startedAt: task.startedAt,
      status: task.status,
    };
    
    if (task.references) {
      sanitizedTask.references = task.references
        .slice(0, MAX_REFERENCES)
        .map(r => sanitize(r, MAX_REFERENCE_LENGTH));
    }
    
    // Atomic write: tmp → rename
    const content = JSON.stringify(sanitizedTask, null, 2);
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, activePath);
    
    debugLog(`Saved active task: "${sanitizedTask.task.slice(0, 50)}..." [${sanitizedTask.status}]`);
    
  } catch (error) {
    errorLog('Failed to save active.json:', error);
    
    // Clean up tmp file if it exists
    try {
      if (existsSync(tmpPath)) {
        unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    
    throw error; // Re-throw so caller knows save failed
  }
}

/**
 * Create a new active task with defaults.
 * 
 * @param taskDescription - What the user wants to do
 * @param mode - Operational mode (ultrathink, quick, expert, collab)
 * @param constraints - Optional constraints to apply
 * @returns New ActiveTask ready to save
 */
export function createActiveTask(
  taskDescription: string,
  mode: string = 'ultrathink',
  constraints: ConstraintType[] = []
): ActiveTask {
  return {
    task: sanitize(taskDescription, MAX_TASK_LENGTH),
    mode: sanitize(mode, 50),
    constraints: constraints.filter(isValidConstraint),
    startedAt: new Date().toISOString(),
    status: 'in_progress',
  };
}

/**
 * Update task status and optionally save.
 * 
 * @param projectDir - Project root directory
 * @param status - New status
 * @returns Updated task or null if no active task
 */
export function updateTaskStatus(
  projectDir: string,
  status: TaskStatus
): ActiveTask | null {
  const task = loadActiveTask(projectDir);
  if (!task) return null;
  
  task.status = status;
  saveActiveTask(projectDir, task);
  
  return task;
}

/**
 * Clear active task (on completion or cancellation).
 * 
 * @param projectDir - Project root directory
 */
export function clearActiveTask(projectDir: string): void {
  const path = join(projectDir, '.setu', ACTIVE_JSON);
  
  try {
    if (existsSync(path)) {
      unlinkSync(path);
      debugLog('Cleared active task');
    }
  } catch (error) {
    errorLog('Failed to clear active.json:', error);
  }
}

/**
 * Check if a tool should be blocked due to active constraints.
 * 
 * @param tool - Tool name being executed
 * @param constraints - Active constraints
 * @param args - Tool arguments (for context-sensitive blocking)
 * @returns Object with blocked status and reason
 */
export function shouldBlockDueToConstraint(
  tool: string,
  constraints: ConstraintType[],
  args?: Record<string, unknown>
): { blocked: boolean; reason?: string; constraint?: ConstraintType } {
  
  if (constraints.length === 0) {
    return { blocked: false };
  }
  
  // READ_ONLY: Block write/edit tools
  if (constraints.includes(CONSTRAINT_TYPES.READ_ONLY)) {
    if (['write', 'edit'].includes(tool)) {
      return {
        blocked: true,
        reason: `Active task has READ_ONLY constraint. Cannot ${tool} files.`,
        constraint: CONSTRAINT_TYPES.READ_ONLY,
      };
    }
  }
  
  // NO_PUSH: Block git push
  if (constraints.includes(CONSTRAINT_TYPES.NO_PUSH)) {
    if (tool === 'bash') {
      const command = String(args?.command || '');
      if (command.includes('git push')) {
        return {
          blocked: true,
          reason: 'Active task has NO_PUSH constraint. Cannot push to remote.',
          constraint: CONSTRAINT_TYPES.NO_PUSH,
        };
      }
    }
  }
  
  // NO_DELETE: Block destructive operations
  if (constraints.includes(CONSTRAINT_TYPES.NO_DELETE)) {
    if (tool === 'bash') {
      const command = String(args?.command || '');
      if (
        command.includes('rm ') ||
        command.includes('rm -') ||
        command.includes('git reset --hard') ||
        command.includes('git clean -f')
      ) {
        return {
          blocked: true,
          reason: 'Active task has NO_DELETE constraint. Cannot delete files or reset git.',
          constraint: CONSTRAINT_TYPES.NO_DELETE,
        };
      }
    }
  }
  
  // SANDBOX: Block operations outside project (basic check)
  // Note: Full implementation would need projectDir context
  if (constraints.includes(CONSTRAINT_TYPES.SANDBOX)) {
    if (tool === 'bash') {
      const command = String(args?.command || '');
      // Basic heuristics for escaping project dir
      if (
        command.includes('cd /') ||
        command.includes('cd ~') ||
        command.includes('../..') ||
        command.startsWith('/')
      ) {
        return {
          blocked: true,
          reason: 'Active task has SANDBOX constraint. Cannot operate outside project directory.',
          constraint: CONSTRAINT_TYPES.SANDBOX,
        };
      }
    }
  }
  
  return { blocked: false };
}
