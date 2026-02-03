/**
 * Attempt Tracking with Gear Shifting
 * 
 * Prevents infinite retry loops. When approach fails, agent should
 * learn and adapt by updating research/plan.
 * 
 * Key behaviors:
 * - Track attempts per task with approach descriptions
 * - After N failed attempts, suggest gear shift (update RESEARCH/PLAN)
 * - Persist failed approaches to prevent ghost loops (when persistence callback provided)
 */

import { debugLog } from '../debug';

export interface AttemptState {
  taskId: string;
  attempts: number;
  maxAttempts: number;  // From config, default 3
  approaches: Array<{
    description: string;
    succeeded: boolean;
    timestamp: string;
  }>;
}

export interface AttemptTrackerConfig {
  maxAttempts?: number;  // Default: 3
  /** Optional callback to persist failed approaches (implemented in Phase 3) */
  onFailedApproach?: (approach: string) => void;
}

export interface AttemptTracker {
  recordAttempt: (taskId: string, approach: string, succeeded: boolean) => number;
  shouldSuggestGearShift: (taskId: string) => boolean;
  getGearShiftMessage: (taskId: string) => string;
  getLearnings: (taskId: string) => string;  // For injecting into RESEARCH.md
  reset: (taskId: string) => void;
  clearAll: () => void;
}

/**
 * Creates an attempt tracker for monitoring and limiting retry attempts.
 * 
 * @param config - Configuration with maxAttempts (default 3) and optional persistence callback
 * @returns AttemptTracker interface for recording and querying attempt state
 */
export function createEnhancedAttemptTracker(config: AttemptTrackerConfig = {}): AttemptTracker {
  const attempts = new Map<string, AttemptState>();
  const maxAttempts = config.maxAttempts ?? 3;
  const onFailedApproach = config.onFailedApproach;
  
  return {
    /**
     * Record an attempt at solving a task
     * 
     * @param taskId - Unique identifier for the task
     * @param approach - Description of the approach taken
     * @param succeeded - Whether the attempt succeeded
     * @returns Current attempt count
     */
    recordAttempt: (taskId: string, approach: string, succeeded: boolean): number => {
      const state = attempts.get(taskId) || { 
        taskId, 
        attempts: 0, 
        maxAttempts,
        approaches: [] 
      };
      state.attempts++;
      state.approaches.push({
        description: approach,
        succeeded,
        timestamp: new Date().toISOString()
      });
      attempts.set(taskId, state);
      
      // Persist failed approaches after 2nd failure to prevent ghost loops
      // (Phase 3 will provide the persistence callback)
      if (!succeeded && state.attempts >= 2 && onFailedApproach) {
        onFailedApproach(approach);
        debugLog(`Attempt tracker: Recorded failed approach "${approach}" for task ${taskId}`);
      }
      
      return state.attempts;
    },
    
    /**
     * Check if we should suggest a gear shift (update RESEARCH/PLAN)
     * 
     * @param taskId - Unique identifier for the task
     * @returns true if failed attempts >= maxAttempts
     */
    shouldSuggestGearShift: (taskId: string): boolean => {
      const state = attempts.get(taskId);
      if (!state) return false;
      // Suggest gear shift after N failed attempts
      const failedCount = state.approaches.filter(a => !a.succeeded).length;
      return failedCount >= state.maxAttempts;
    },
    
    /**
     * Get a formatted message suggesting gear shift
     * 
     * @param taskId - Unique identifier for the task
     * @returns Formatted message with failed approaches and suggestions
     */
    getGearShiftMessage: (taskId: string): string => {
      const state = attempts.get(taskId);
      if (!state) return '';
      
      const failedApproaches = state.approaches.filter(a => !a.succeeded);
      
      return `After ${state.attempts} attempts, consider shifting gear:
- Use \`setu_research\` to update RESEARCH.md with learnings
- Use \`setu_plan\` to revise PLAN.md with new approach

Failed approaches:
${failedApproaches.map(a => `- ${a.description}`).join('\n')}`;
    },
    
    /**
     * Get formatted learnings for injection into RESEARCH.md
     * 
     * @param taskId - Unique identifier for the task
     * @returns Markdown formatted learnings section
     */
    getLearnings: (taskId: string): string => {
      const state = attempts.get(taskId);
      if (!state) return '';
      
      const worked = state.approaches.filter(a => a.succeeded);
      const failed = state.approaches.filter(a => !a.succeeded);
      
      return `### What Worked
${worked.map(a => `- ${a.description}`).join('\n') || '- (none yet)'}

### What Failed
${failed.map(a => `- ${a.description}`).join('\n') || '- (none yet)'}`;
    },
    
    /**
     * Reset attempts for a task (on success or user intervention)
     * 
     * @param taskId - Unique identifier for the task
     */
    reset: (taskId: string): void => {
      attempts.delete(taskId);
    },
    
    /**
     * Clear all attempt tracking
     */
    clearAll: (): void => {
      attempts.clear();
    }
  };
}
