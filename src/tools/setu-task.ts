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
import {
  createActiveTask,
  saveActiveTask,
  loadActiveTask,
  updateTaskStatus,
  clearActiveTask,
  type ActiveTask,
  type ConstraintType,
  type SetuMode,
  type TaskStatus,
  CONSTRAINT_TYPES
} from '../context/active';
import { debugLog } from '../debug';

/**
 * Valid constraint names for input validation
 */
const VALID_CONSTRAINTS = Object.values(CONSTRAINT_TYPES);

/**
 * Valid modes for input validation
 */
const VALID_MODES: SetuMode[] = ['ultrathink', 'quick', 'collab'];

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
 * Validates mode, returns default if invalid
 */
function validateMode(input: string | undefined): SetuMode {
  if (input && VALID_MODES.includes(input as SetuMode)) {
    return input as SetuMode;
  }
  return 'ultrathink';
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
**Mode:** ${task.mode}
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
- \`update\`: Change task status (in_progress, completed, blocked)
- \`clear\`: Remove the active task (on completion or cancellation)
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
        'Action to perform: create, update, clear, get'
      ),
      task: tool.schema.string().optional().describe(
        'Task description (required for create)'
      ),
      mode: tool.schema.string().optional().describe(
        'Operational mode: ultrathink, quick, collab (default: ultrathink)'
      ),
      constraints: tool.schema.array(tool.schema.string()).optional().describe(
        'Constraints to apply: READ_ONLY, NO_PUSH, NO_DELETE, SANDBOX'
      ),
      status: tool.schema.string().optional().describe(
        'New status for update action: in_progress, completed, blocked'
      ),
      references: tool.schema.array(tool.schema.string()).optional().describe(
        'Reference URLs or file paths related to the task'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const projectDir = getProjectDir();
      const action = args.action?.toLowerCase();
      
      switch (action) {
        case 'create': {
          if (!args.task) {
            return `**Error:** Task description is required for create action.

Example:
\`\`\`
setu_task({
  action: "create",
  task: "Implement user authentication",
  mode: "ultrathink",
  constraints: ["NO_PUSH"]
})
\`\`\``;
          }
          
          const mode = validateMode(args.mode);
          const constraints = validateConstraints(args.constraints);
          
          // Create and save the task
          const newTask = createActiveTask(args.task, mode, constraints);
          
          // Add references if provided
          if (args.references && args.references.length > 0) {
            newTask.references = args.references;
          }
          
          saveActiveTask(projectDir, newTask);
          
          // Reset verification state for new task
          if (resetVerificationState) {
            resetVerificationState();
            debugLog('Verification state reset for new task');
          }
          
          debugLog(`Created active task: "${args.task.slice(0, 50)}..."`);
          
          const constraintNote = constraints.length > 0
            ? `\n\n**Enforcement:** The following constraints are now active and will block violating tool calls:\n${constraints.map(c => `- \`${c}\``).join('\n')}`
            : '';
          
          return `## Task Created

${formatTask(newTask)}${constraintNote}

Task saved to \`.setu/active.json\`. Constraints will be enforced until task is cleared.`;
        }
        
        case 'update': {
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
            return `**Error:** Valid status required for update action.

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

Status changed to \`${newStatus}\`.`;
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
          return `**Error:** Unknown action \`${action}\`.

Valid actions:
- \`create\`: Start a new task
- \`update\`: Change task status
- \`clear\`: Remove active task
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
