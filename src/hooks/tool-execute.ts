/**
 * Tool execute hooks - Track verification steps and attempt limits
 * 
 * Uses: tool.execute.before, tool.execute.after
 * 
 * Tracks when build/test/lint commands are run for verification,
 * and implements the "2 attempts then ask" pattern.
 */

/**
 * Verification step tracking
 */
export type VerificationStep = 'build' | 'test' | 'lint';

/**
 * Creates the tool.execute.after hook for verification tracking
 * 
 * Monitors bash commands for build/test/lint patterns and marks them as run.
 */
export function createToolExecuteAfterHook(
  markVerificationStep: (step: VerificationStep) => void
) {
  return async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: unknown }
  ): Promise<void> => {
    // Only track bash tool executions
    if (input.tool !== 'bash') return;
    
    const commandOutput = output.output.toLowerCase();
    const title = output.title.toLowerCase();
    
    // Detect build commands
    if (
      title.includes('build') ||
      commandOutput.includes('npm run build') ||
      commandOutput.includes('pnpm build') ||
      commandOutput.includes('yarn build') ||
      commandOutput.includes('bun build') ||
      commandOutput.includes('cargo build') ||
      commandOutput.includes('go build')
    ) {
      markVerificationStep('build');
      console.log('[Setu] Verification step tracked: build');
    }
    
    // Detect test commands
    if (
      title.includes('test') ||
      commandOutput.includes('npm test') ||
      commandOutput.includes('pnpm test') ||
      commandOutput.includes('yarn test') ||
      commandOutput.includes('bun test') ||
      commandOutput.includes('vitest') ||
      commandOutput.includes('jest') ||
      commandOutput.includes('pytest') ||
      commandOutput.includes('cargo test') ||
      commandOutput.includes('go test')
    ) {
      markVerificationStep('test');
      console.log('[Setu] Verification step tracked: test');
    }
    
    // Detect lint commands
    if (
      title.includes('lint') ||
      commandOutput.includes('npm run lint') ||
      commandOutput.includes('eslint') ||
      commandOutput.includes('biome') ||
      commandOutput.includes('ruff') ||
      commandOutput.includes('clippy') ||
      commandOutput.includes('golangci-lint')
    ) {
      markVerificationStep('lint');
      console.log('[Setu] Verification step tracked: lint');
    }
  };
}

/**
 * Attempt tracker for the "2 attempts then ask" pattern
 * 
 * Tracks failed attempts at solving a problem and suggests asking
 * for guidance after 2 failures.
 */
export interface AttemptState {
  taskId: string;
  attempts: number;
  approaches: string[];
}

export function createAttemptTracker() {
  const attempts = new Map<string, AttemptState>();
  
  return {
    /**
     * Record an attempt at solving a task
     */
    recordAttempt: (taskId: string, approach: string): number => {
      const state = attempts.get(taskId) || { taskId, attempts: 0, approaches: [] };
      state.attempts++;
      state.approaches.push(approach);
      attempts.set(taskId, state);
      return state.attempts;
    },
    
    /**
     * Get attempt state for a task
     */
    getAttempts: (taskId: string): AttemptState | undefined => {
      return attempts.get(taskId);
    },
    
    /**
     * Check if we should ask for guidance (2+ attempts)
     */
    shouldAskForGuidance: (taskId: string): boolean => {
      const state = attempts.get(taskId);
      return state ? state.attempts >= 2 : false;
    },
    
    /**
     * Get a formatted guidance message
     */
    getGuidanceMessage: (taskId: string): string | null => {
      const state = attempts.get(taskId);
      if (!state || state.attempts < 2) return null;
      
      const approachList = state.approaches
        .slice(-2)
        .map((a, i) => `${i + 1}. ${a}`)
        .join('\n');
      
      return `I've tried ${state.attempts} approaches without success:

${approachList}

Would you like me to try a different approach, or do you have guidance?`;
    },
    
    /**
     * Reset attempts for a task (on success or user intervention)
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

export type AttemptTracker = ReturnType<typeof createAttemptTracker>;
