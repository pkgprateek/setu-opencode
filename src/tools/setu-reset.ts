import { tool } from '@opencode-ai/plugin';
import { resetProgress, loadActiveTask, saveActiveTask } from '../context/active';

export const createSetuResetTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Reset step progress to 0. Use when you want to restart the current plan from the beginning.',
  args: {
    clearLearnings: tool.schema.boolean().optional().describe('Also clear learned approaches (default: false)')
  },
  async execute(args, _context) {
    const projectDir = getProjectDir();

    // Wrap loadActiveTask in try/catch - file may be corrupted
    let active: ReturnType<typeof loadActiveTask>;
    try {
      active = loadActiveTask(projectDir);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : String(loadError);
      console.error(`[Setu] Failed to load active.json: ${msg}`);
      active = null; // Fall back to null, continue with reset
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
        const msg = error instanceof Error ? error.message : String(error);
        return `Failed to reset progress: ${msg}. Check .setu/ directory permissions.`;
      }
    } else {
      try {
        resetProgress(projectDir);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return `Failed to reset progress: ${msg}. Check .setu/ directory permissions.`;
      }
    }
    
    return args.clearLearnings
      ? `Progress reset to Step 0. Learnings cleared. Starting fresh.`
      : `Progress reset to Step 0. Learnings preserved (failed approaches still remembered).`;
  }
});
