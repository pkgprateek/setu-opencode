/**
 * setu_task tool - Manage active tasks with constraints
 * 
 * Creates, updates, and clears active tasks in .setu/active.json.
 * Active tasks persist across sessions and survive context compaction.
 * 
 * Constraints:
 * - READ_ONLY: Block write/edit tools
 * - NO_PUSH: Block git push
 * - NO_DELETE: Block rm and git reset --hard
 * - SANDBOX: Block operations outside project directory
 */

import { tool } from '@opencode-ai/plugin';
import { appendFile, readFile, unlink } from 'fs/promises';
import { isAbsolute, join, normalize } from 'path';
import {
  createActiveTask,
  saveActiveTask,
  loadActiveTask,
  updateTaskStatus,
  clearActiveTask,
  type ActiveTask,
  type ConstraintType,
  type TaskStatus,
  CONSTRAINT_TYPES
} from '../context/active';
import { debugLog, errorLog } from '../debug';
import { getErrorMessage } from '../utils/error-handling';
import { removeControlChars } from '../utils/sanitization';
import { validateProjectDir } from '../utils/path-validation';

/**
 * Valid constraint names for input validation
 */
const VALID_CONSTRAINTS = Object.values(CONSTRAINT_TYPES);

/**
 * Valid statuses for input validation
 */
const VALID_STATUSES: TaskStatus[] = ['in_progress', 'completed', 'blocked'];

/**
 * Validates and filters constraints to only valid values
 */
function validateConstraints(input: string[] | undefined): ConstraintType[] {
  if (!input || !Array.isArray(input)) return [];
  return input.filter((c): c is ConstraintType => 
    VALID_CONSTRAINTS.includes(c as ConstraintType)
  );
}

/**
 * Validates status, returns null if invalid
 */
function validateStatus(input: string | undefined): TaskStatus | null {
  if (input && VALID_STATUSES.includes(input as TaskStatus)) {
    return input as TaskStatus;
  }
  return null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sanitizeReferences(references: string[] | undefined): string[] {
  if (!references || !Array.isArray(references)) return [];

  return references
    .map((reference) => removeControlChars(reference).trim())
    .filter((reference) => reference.length > 0)
    .filter((reference) => {
      if (/^https?:\/\//i.test(reference)) {
        try {
          const parsed = new URL(reference);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      }

      // Allow plain file path references while rejecting URI-like schemes.
      if (reference.includes('://')) {
        return false;
      }

      if (isAbsolute(reference)) {
        return false;
      }

      const normalized = normalize(reference).replace(/\\/g, '/');
      const segments = normalized.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '..')) {
        return false;
      }

      return true;
    });
}

/**
 * Format task for display
 */
function formatTask(task: ActiveTask): string {
  const constraintList = task.constraints.length > 0
    ? task.constraints.join(', ')
    : 'none';
  
  const refList = task.references && task.references.length > 0
    ? `\n**References:** ${task.references.join(', ')}`
    : '';
  
  return `**Task:** ${task.task}
**Status:** ${task.status}
**Constraints:** ${constraintList}
**Started:** ${task.startedAt}${refList}`;
}

/**
 * Creates the setu_task tool for managing active tasks
 * 
 * @param getProjectDir - Accessor for project directory
 * @param resetVerificationState - Callback to reset verification when new task starts
 */
export function createSetuTaskTool(
  getProjectDir: () => string,
  resetVerificationState?: () => void
): ReturnType<typeof tool> {
  return tool({
    description: `Manage active tasks with constraints.

**Actions:**
- \`create\`: Start a new task with optional constraints
- \`reframe\`: Update task intent/constraints without resetting workflow artifacts
- \`update_status\`: Change task status (in_progress, completed, blocked)
- \`clear\`: Manually remove the active task only when user explicitly requests task cancellation/reset
- \`get\`: View current active task

**Constraints:**
- \`READ_ONLY\`: Block write/edit tools (exploration only)
- \`NO_PUSH\`: Block git push (local changes only)
- \`NO_DELETE\`: Block rm and destructive git commands
- \`SANDBOX\`: Block operations outside project directory

Active tasks persist to \`.setu/active.json\` and survive:
- Session restarts
- Context compaction
- OpenCode restarts`,
    
    args: {
      action: tool.schema.string().describe(
        'Action to perform: create, reframe, update_status, clear (manual), get'
      ),
      task: tool.schema.string().optional().describe(
        'Task description (required for create)'
      ),
      constraints: tool.schema.array(tool.schema.string()).optional().describe(
        'Constraints to apply: READ_ONLY, NO_PUSH, NO_DELETE, SANDBOX'
      ),
      status: tool.schema.string().optional().describe(
        'New status for update_status action: in_progress, completed, blocked'
      ),
      references: tool.schema.array(tool.schema.string()).optional().describe(
        'Reference URLs or file paths related to the task'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const projectDir = getProjectDir();
      validateProjectDir(projectDir);
      const action = removeControlChars(String(args.action ?? '').toLowerCase()).trim() || 'unknown';
      
      switch (action) {
        case 'create': {
          const sanitizedTask = removeControlChars(args.task ?? '').trim();

          if (!sanitizedTask) {
            return `**Error:** Task description is required for create action.

Example:
\`\`\`
setu_task({
  action: "create",
  task: "Implement user authentication",
  constraints: ["NO_PUSH"]
})
\`\`\``;
          }

          // Archive old artifacts to reset gear to scout.
          // New task should not inherit previous task's RESEARCH/PLAN artifacts.
          const setuDir = join(projectDir, '.setu');
          const researchPath = join(setuDir, 'RESEARCH.md');
          const planPath = join(setuDir, 'PLAN.md');
          const historyPath = join(setuDir, 'HISTORY.md');

          try {
            const timestamp = new Date().toISOString();
            const oldResearch = await readFile(researchPath, 'utf-8');
            const archiveEntry = `\n---\n## Archived Research (${timestamp})\n\n${oldResearch}\n`;
            await appendFile(historyPath, archiveEntry, 'utf-8');
            await unlink(researchPath);
            debugLog('Archived old RESEARCH.md to HISTORY.md');
          } catch (archiveError) {
            if (isNodeError(archiveError) && archiveError.code === 'ENOENT') {
              // Nothing to archive.
            } else {
            debugLog(`Failed to archive RESEARCH.md: ${getErrorMessage(archiveError)}`);
            // Continue — partial archive failure should not block task creation
            }
          }

          try {
            const timestamp = new Date().toISOString();
            const oldPlan = await readFile(planPath, 'utf-8');
            const archiveEntry = `\n---\n## Archived Plan (${timestamp})\n\n${oldPlan}\n`;
            await appendFile(historyPath, archiveEntry, 'utf-8');
            await unlink(planPath);
            debugLog('Archived old PLAN.md to HISTORY.md');
          } catch (archiveError) {
            if (isNodeError(archiveError) && archiveError.code === 'ENOENT') {
              // Nothing to archive.
            } else {
            debugLog(`Failed to archive PLAN.md: ${getErrorMessage(archiveError)}`);
            // Continue — partial archive failure should not block task creation
            }
          }
          
          const constraints = validateConstraints(args.constraints);
          
          // Create and save the task
          const newTask = createActiveTask(sanitizedTask, constraints);
          
          // Add references if provided
          const sanitizedReferences = sanitizeReferences(args.references);
          if (sanitizedReferences.length > 0) {
            newTask.references = sanitizedReferences;
          }
          
          try {
            saveActiveTask(projectDir, newTask);
          } catch (saveError) {
            debugLog(`Failed to save new task in ${projectDir}: ${getErrorMessage(saveError)}`);
            return `**Error:** Failed to save new task. Please retry.`;
          }
          
          // Reset verification state for new task
          if (resetVerificationState) {
            resetVerificationState();
            debugLog('Verification state reset for new task');
          }
          
          debugLog(`Created active task: "${sanitizedTask.slice(0, 50)}..."`);
          
          const constraintNote = constraints.length > 0
            ? `\n\n**Enforcement:** The following constraints are now active and will block violating tool calls:\n${constraints.map(c => `- \`${c}\``).join('\n')}`
            : '';
          
          return `## Task Created

${formatTask(newTask)}${constraintNote}

Task saved to \`.setu/active.json\`. This replaces the previous task boundary and constraints will be enforced until explicitly changed.`;
        }

        case 'reframe': {
          const currentTask = loadActiveTask(projectDir);

          if (!currentTask) {
            return `**Error:** No active task found to reframe.

Create a task first:
\`\`\`
setu_task({ action: "create", task: "Your task description" })
\`\`\``;
          }

          const sanitizedTask = removeControlChars(args.task ?? '').trim();

          if (!sanitizedTask) {
            return `**Error:** Task description is required for reframe action.

Example:
\`\`\`
setu_task({
  action: "reframe",
  task: "Refine auth rotation fix for backward compatibility",
  constraints: ["NO_PUSH"]
})
\`\`\``;
          }

          const validatedConstraintUpdate = args.constraints ? validateConstraints(args.constraints) : null;
          const attemptedConstraintClear = args.constraints !== undefined && (validatedConstraintUpdate?.length ?? 0) === 0;
          const attemptedConstraintDowngrade =
            validatedConstraintUpdate !== null &&
            validatedConstraintUpdate.length > 0 &&
            currentTask.constraints.some((existing) => !validatedConstraintUpdate.includes(existing));

          if (attemptedConstraintClear || attemptedConstraintDowngrade) {
            const blockedActions: string[] = [];
            if (attemptedConstraintClear) blockedActions.push('clear');
            if (attemptedConstraintDowngrade) blockedActions.push('downgrade');
            errorLog(`[AUDIT] Constraint ${blockedActions.join('+')} attempt during reframe blocked. Project: ${projectDir}`);
          }

          // nextConstraints preserves currentTask.constraints when attemptedConstraintDowngrade is true;
          // otherwise it applies validatedConstraintUpdate only when non-empty. attemptedConstraintClear
          // forces validatedConstraintUpdate empty, so this falls back to currentTask.constraints.
          const nextConstraints = attemptedConstraintDowngrade
            ? currentTask.constraints
            : (validatedConstraintUpdate && validatedConstraintUpdate.length > 0
              ? validatedConstraintUpdate
              : currentTask.constraints);

          const reframedTask: ActiveTask = {
            ...currentTask,
            task: sanitizedTask,
            constraints: nextConstraints,
          };

          const sanitizedReferences = sanitizeReferences(args.references);
          if (sanitizedReferences.length > 0) {
            reframedTask.references = sanitizedReferences;
          }

          try {
            saveActiveTask(projectDir, reframedTask);
          } catch (saveError) {
            debugLog(`Failed to save reframed task in ${projectDir}: ${getErrorMessage(saveError)}`);
            return `**Error:** Failed to save reframed task. Please retry.`;
          }
          debugLog(`Reframed active task: "${sanitizedTask.slice(0, 50)}..."`);

          return `## Task Reframed

${formatTask(reframedTask)}

Workflow artifacts were preserved. Continue with \`setu_research\`/\`setu_plan\` in append or auto mode.`;
        }
        
        case 'update_status': {
          const currentTask = loadActiveTask(projectDir);
          
          if (!currentTask) {
            return `**Error:** No active task found.

Create a task first:
\`\`\`
setu_task({ action: "create", task: "Your task description" })
\`\`\``;
          }
          
          const newStatus = validateStatus(args.status);
          
          if (!newStatus) {
            return `**Error:** Valid status required for update_status action.

Valid statuses: \`in_progress\`, \`completed\`, \`blocked\`

Current task:
${formatTask(currentTask)}`;
          }
          
          const updatedTask = updateTaskStatus(projectDir, newStatus);
          
          if (!updatedTask) {
            return `**Error:** Failed to update task status.`;
          }
          
          debugLog(`Updated task status to: ${newStatus}`);
          
          return `## Task Updated

${formatTask(updatedTask)}

Status changed to \`${newStatus}\`. Task remains active for follow-up \`reframe\` or additional status updates.`;
        }
        
        case 'clear': {
          const currentTask = loadActiveTask(projectDir);
          
          if (!currentTask) {
            return `No active task to clear.`;
          }
          
          clearActiveTask(projectDir);
          debugLog('Active task cleared');
          
          return `## Task Cleared

Previous task was:
${formatTask(currentTask)}

The \`.setu/active.json\` file has been removed. All constraints are now lifted.`;
        }
        
        case 'get': {
          const currentTask = loadActiveTask(projectDir);
          
          if (!currentTask) {
            return `**No active task.**

Create a task to track your current work:
\`\`\`
setu_task({
  action: "create",
  task: "Your task description",
  constraints: ["READ_ONLY"]  // optional
})
\`\`\``;
          }
          
          return `## Active Task

${formatTask(currentTask)}`;
        }
        
        default: {
          const sanitizedAction = action.replace(/[\[`\]]/g, '');
          return `**Error:** Unknown action \`${sanitizedAction || 'unknown'}\`.

Valid actions:
- \`create\`: Start a new task
- \`reframe\`: Update task intent/constraints while preserving artifacts
- \`update_status\`: Change task status
- \`clear\`: Manual reset (explicit user request only)
- \`get\`: View current task

Example:
\`\`\`
setu_task({ action: "get" })
\`\`\``;
        }
      }
    }
  });
}
