/**
 * Tool execution hooks - Track tool usage and enforce patterns
 */

export interface ToolExecuteInput {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolExecuteOutput {
  args?: Record<string, unknown>;
  warning?: string;
}

/**
 * Track build/test/lint tool usage for verification tracking
 */
export function createToolExecuteAfterHook(
  markVerificationStep: (step: 'build' | 'test' | 'lint') => void
) {
  return async (
    input: ToolExecuteInput,
    _output: ToolExecuteOutput
  ): Promise<void> => {
    // Detect verification-related tool calls
    if (input.tool === 'bash') {
      const command = String(input.args.command || '');
      
      if (
        command.includes('npm run build') ||
        command.includes('pnpm build') ||
        command.includes('yarn build') ||
        command.includes('bun build')
      ) {
        markVerificationStep('build');
      }
      
      if (
        command.includes('npm test') ||
        command.includes('pnpm test') ||
        command.includes('yarn test') ||
        command.includes('bun test') ||
        command.includes('vitest') ||
        command.includes('jest')
      ) {
        markVerificationStep('test');
      }
      
      if (
        command.includes('npm run lint') ||
        command.includes('pnpm lint') ||
        command.includes('eslint') ||
        command.includes('biome')
      ) {
        markVerificationStep('lint');
      }
    }
  };
}

/**
 * Count attempt failures for the attempt limiter
 */
export interface AttemptState {
  taskId: string;
  attempts: number;
  approaches: string[];
}

export function createAttemptTracker() {
  const attempts = new Map<string, AttemptState>();
  
  return {
    recordAttempt: (taskId: string, approach: string): number => {
      const state = attempts.get(taskId) || { taskId, attempts: 0, approaches: [] };
      state.attempts++;
      state.approaches.push(approach);
      attempts.set(taskId, state);
      return state.attempts;
    },
    
    getAttempts: (taskId: string): AttemptState | undefined => {
      return attempts.get(taskId);
    },
    
    shouldAskForGuidance: (taskId: string): boolean => {
      const state = attempts.get(taskId);
      return state ? state.attempts >= 2 : false;
    },
    
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
    
    reset: (taskId: string): void => {
      attempts.delete(taskId);
    }
  };
}
