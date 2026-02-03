import { tool } from '@opencode-ai/plugin';
import { resetProgress, loadActiveTask, saveActiveTask } from '../context/active';

export const createSetuResetTool = (getProjectDir: () => string): ReturnType<typeof tool> => tool({
  description: 'Reset step progress to 0. Use when you want to restart the current plan from the beginning.',
  args: {
    clearLearnings: tool.schema.boolean().optional().describe('Also clear learned approaches (default: false)')
  },
  async execute(args, _context) {
    const projectDir = getProjectDir();
    
    // Reset progress
    resetProgress(projectDir);
    
    // Optionally clear learnings
    if (args.clearLearnings) {
      const active = loadActiveTask(projectDir);
      if (active) {
        active.learnings = { worked: [], failed: [] };
        saveActiveTask(projectDir, active);
      }
    }
    
    return args.clearLearnings
      ? `Progress reset to Step 0. Learnings cleared. Starting fresh.`
      : `Progress reset to Step 0. Learnings preserved (failed approaches still remembered).`;
  }
});
