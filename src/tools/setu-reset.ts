import { tool } from '@opencode-ai/plugin';
import { validateProjectDir } from '../utils/path-validation';
import { loadActiveTask, saveActiveTask } from '../context/active';
import { getErrorMessage } from '../utils/error-handling';
import { errorLog, debugLog } from '../debug';
import { join } from 'path';
import { existsSync } from 'fs';

export const createSetuResetTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Reset step progress to 0. Use when you want to restart the current plan from the beginning.',
  args: {
    clearLearnings: tool.schema.boolean().optional().describe('Also clear learned approaches (default: false)')
  },
  async execute(args, _context) {
    const projectDir = getProjectDir();
    try {
      validateProjectDir(projectDir);
    } catch (error) {
      throw new Error(`Invalid project directory: ${getErrorMessage(error)}`);
    }

    // Wrap loadActiveTask in try/catch - file may be corrupted
    let active: ReturnType<typeof loadActiveTask>;
    let loadFailed = false;
    const activePath = join(projectDir, '.setu', 'active.json');
    const fileExists = existsSync(activePath);

    try {
      active = loadActiveTask(projectDir);
    } catch (loadError) {
      // Should not happen as loadActiveTask catches internally, but safe
      errorLog(`Failed to load active.json: ${getErrorMessage(loadError)}`, loadError);
      active = null;
    }

    if (!active && fileExists) {
      // File exists but load returned null -> corruption
      loadFailed = true;
    }
    
    if (active) {
      active.progress = {
        lastCompletedStep: 0,
        lastCompletedAt: new Date().toISOString()
      };

      if (args.clearLearnings) {
        active.learnings = { worked: [], failed: [] };
      }

      try {
        saveActiveTask(projectDir, active);
      } catch (error) {
        // Throw Error instead of returning string for consistency
        throw new Error(`Failed to save active.json during reset: ${getErrorMessage(error)}`);
      }
    } else {
      // If no active task, there's nothing to reset
      // Report corruption if detected
      if (loadFailed) {
         return `Failed to load active task (possibly corrupted). Check .setu/active.json.`;
      }
      return `No active task found to reset.`;
    }
    
    // SECURITY: Log state mutation audit
    debugLog(`[AUDIT] Progress reset: Step 0. Learnings cleared: ${!!args.clearLearnings}. Project: ${projectDir}`);

    return args.clearLearnings
      ? `Progress reset to Step 0. Learnings cleared. Starting fresh.`
      : `Progress reset to Step 0. Learnings preserved (failed approaches still remembered).`;
  }
});
