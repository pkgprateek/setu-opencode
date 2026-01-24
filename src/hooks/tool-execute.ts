/**
 * Tool execute hooks - Track verification steps and attempt limits
 * 
 * Uses: tool.execute.before, tool.execute.after
 * 
 * - tool.execute.before: Phase 0 blocking (pre-emptive enforcement)
 *   - Mode-aware: Full enforcement in Setu, light in Build, defer in Plan
 *   - Context injection: Injects context into subagent prompts (task tool)
 * - tool.execute.after: Tracks verification steps, file reads, searches
 */

import {
  shouldBlockInPhase0,
  createPhase0BlockMessage,
  type Phase0State
} from '../enforcement';
import { type ContextCollector, formatContextForInjection, contextToSummary } from '../context';

/**
 * Verification step tracking
 */
export type VerificationStep = 'build' | 'test' | 'lint';

/**
 * Input type for tool.execute.before hook (from OpenCode API)
 */
export interface ToolExecuteBeforeInput {
  tool: string;
  sessionID: string;
  callID: string;
}

/**
 * Output type for tool.execute.before hook (from OpenCode API)
 */
export interface ToolExecuteBeforeOutput {
  args: Record<string, unknown>;
}

/**
 * Enforcement level based on current agent
 */
export type EnforcementLevel = 'full' | 'light' | 'none';

/**
 * Map an agent identifier to its Phase 0 enforcement level.
 *
 * @param currentAgent - The agent name (case-insensitive)
 * @returns `'full'` for `'setu'`, `'none'` for `'plan'`, `'light'` for all other agents
 */
export function getEnforcementLevel(currentAgent: string): EnforcementLevel {
  const agent = currentAgent.toLowerCase();
  
  if (agent === 'setu') {
    return 'full';
  }
  
  if (agent === 'plan') {
    // Plan mode is already read-only by OpenCode design
    return 'none';
  }
  
  // Build and other agents get light enforcement
  return 'light';
}

/**
 * Create a before-execution hook that enforces Phase 0 rules for tool execution.
 *
 * The returned hook injects confirmed context into `task` (subagent) prompts when available,
 * honors agent-specific enforcement levels (setu => full, plan => none, build/other => light),
 * and blocks or warns about disallowed tools based on Phase 0 state.
 *
 * @param getPhase0State - Accessor that returns the current Phase 0 state
 * @param getCurrentAgent - Optional accessor for the current agent identifier; defaults to "setu" when omitted
 * @param getContextCollector - Optional accessor for a ContextCollector used to obtain and format confirmed context for injection
 * @returns A hook function invoked before tool execution that enforces Phase 0 rules and may throw an Error when a tool is blocked under full enforcement
 */
export function createToolExecuteBeforeHook(
  getPhase0State: () => Phase0State,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null
) {
  return async (
    input: ToolExecuteBeforeInput,
    output: ToolExecuteBeforeOutput
  ): Promise<void> => {
    const state = getPhase0State();
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    const enforcementLevel = getEnforcementLevel(currentAgent);
    
    // Context injection for task tool (subagent prompts)
    if (input.tool === 'task' && getContextCollector) {
      const collector = getContextCollector();
      if (collector && collector.getContext().confirmed) {
        const context = collector.getContext();
        const summary = contextToSummary(context);
        const contextBlock = formatContextForInjection(summary);
        
        // Inject context at the beginning of the prompt
        const originalPrompt = output.args.prompt as string || '';
        output.args.prompt = `${contextBlock}\n\n[TASK]\n${originalPrompt}`;
        
        console.log('[Setu] Injected context into subagent prompt');
      }
    }
    
    // No enforcement in Plan mode (OpenCode handles it)
    if (enforcementLevel === 'none') {
      return;
    }
    
    // If context is confirmed, allow everything
    if (state.contextConfirmed) {
      return;
    }
    
    // Check if this tool should be blocked
    const { blocked, reason, details } = shouldBlockInPhase0(input.tool, output.args);
    
    if (blocked && reason) {
      if (enforcementLevel === 'full') {
        // Full enforcement in Setu mode - throw to block
        console.log(`[Setu] Phase 0 BLOCKED: ${input.tool}`);
        throw new Error(createPhase0BlockMessage(reason, details));
      } else {
        // Light enforcement - log warning but don't block
        console.log(`[Setu] Phase 0 WARNING (not in Setu mode): ${input.tool} - ${reason}`);
        return;
      }
    }
    
    // Allowed - log for debugging
    if (enforcementLevel === 'full') {
      console.log(`[Setu] Phase 0 ALLOWED: ${input.tool}`);
    }
  };
}

/**
 * Creates a post-tool-execution hook that records verification steps and context events.
 *
 * Calls `markVerificationStep` when bash command output or titles indicate build, test, or lint activity.
 * When a `ContextCollector` is available it records file reads and grep/glob searches (pattern and result count).
 *
 * @param markVerificationStep - Callback invoked with a verification step ('build' | 'test' | 'lint') when the hook detects the corresponding command.
 * @param getContextCollector - Optional function that returns a `ContextCollector` used to record file reads and search actions; if omitted or it returns `null`, context tracking is disabled.
 */
export function createToolExecuteAfterHook(
  markVerificationStep: (step: VerificationStep) => void,
  getContextCollector?: () => ContextCollector | null
) {
  return async (
    input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
    output: { title: string; output: string; metadata: unknown }
  ): Promise<void> => {
    const collector = getContextCollector ? getContextCollector() : null;
    
    // Track file reads for context collection
    if (input.tool === 'read' && collector) {
      const filePath = input.args?.filePath as string;
      if (filePath) {
        collector.recordFileRead(filePath);
        console.log(`[Setu] Context: Recorded file read: ${filePath}`);
      }
    }
    
    // Track grep searches for context collection
    if (input.tool === 'grep' && collector) {
      const pattern = input.args?.pattern as string;
      if (pattern) {
        // Try to count results from output
        const lines = output.output.split('\n').filter(l => l.trim());
        collector.recordSearch(pattern, 'grep', lines.length);
        console.log(`[Setu] Context: Recorded grep search: ${pattern}`);
      }
    }
    
    // Track glob searches for context collection
    if (input.tool === 'glob' && collector) {
      const pattern = input.args?.pattern as string;
      if (pattern) {
        // Try to count results from output
        const lines = output.output.split('\n').filter(l => l.trim());
        collector.recordSearch(pattern, 'glob', lines.length);
        console.log(`[Setu] Context: Recorded glob search: ${pattern}`);
      }
    }
    
    // Only track verification for bash tool executions
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