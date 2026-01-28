/**
 * Tool execute hooks - Track verification steps and attempt limits
 * 
 * Uses: tool.execute.before, tool.execute.after
 * 
 * - tool.execute.before: Phase 0 blocking (pre-emptive enforcement)
 *   Context injection for subagent prompts (task tool)
 * - tool.execute.after: Tracks verification steps, file reads, searches
 */

import {
  shouldBlockInPhase0,
  createPhase0BlockMessage,
  type Phase0State
} from '../enforcement';
import { type ContextCollector, formatContextForInjection, contextToSummary } from '../context';
import { type SetuProfile, getProfileEnforcementLevel } from '../prompts/profiles';
import { debugLog } from '../debug';

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
 * Enforcement level based on Setu profile
 */
export type EnforcementLevel = 'full' | 'light' | 'none';

/**
 * Determines enforcement level based on Setu profile.
 * Only used when in Setu agent mode.
 *
 * @param setuProfile - The Setu profile (ultrathink/quick/expert/collab)
 * @returns The enforcement level for Phase 0
 */
export function getSetuEnforcementLevel(setuProfile: SetuProfile): EnforcementLevel {
  const profileLevel = getProfileEnforcementLevel(setuProfile);
  
  switch (profileLevel) {
    case 'strict':
      return 'full';    // Ultrathink: full blocking
    case 'none':
      return 'none';    // Quick: no blocking
    case 'light':
      return 'light';   // Expert/Collab: warn but don't block
  }
}

// Deprecated - kept for backwards compatibility
export function getEnforcementLevel(currentAgent: string): EnforcementLevel {
  if (currentAgent.toLowerCase() === 'setu') {
    return 'full';
  }
  return 'none';
}

/**
 * Create a before-execution hook that enforces Phase 0 rules for tool execution.
 *
 * Setu plugin operates exclusively within Setu agent mode.
 * When not in Setu agent, this hook remains silent.
 * When in Setu agent, enforces Phase 0 based on the current profile.
 *
 * @param getPhase0State - Accessor that returns the current Phase 0 state
 * @param getCurrentAgent - Optional accessor for the current agent identifier; defaults to "setu" when omitted
 * @param getContextCollector - Optional accessor for a ContextCollector used to obtain and format confirmed context for injection
 * @param getSetuProfile - Optional accessor for the current Setu profile (used for profile-level enforcement when in Setu mode)
 * @returns A hook function invoked before tool execution that enforces Phase 0 rules and may throw an Error when a tool is blocked under full enforcement
 */
export function createToolExecuteBeforeHook(
  getPhase0State: () => Phase0State,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getSetuProfile?: () => SetuProfile
) {
  return async (
    input: ToolExecuteBeforeInput,
    output: ToolExecuteBeforeOutput
  ): Promise<void> => {
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    
    // Only operate when in Setu agent mode
    if (currentAgent.toLowerCase() !== 'setu') {
      return;
    }
    
    const state = getPhase0State();
    const setuProfile = getSetuProfile ? getSetuProfile() : 'ultrathink';
    const enforcementLevel = getSetuEnforcementLevel(setuProfile);
    
    // Context injection for task tool (subagent prompts)
    if (input.tool === 'task' && getContextCollector) {
      const collector = getContextCollector();
      if (collector && collector.getContext().confirmed) {
        const context = collector.getContext();
        const summary = contextToSummary(context);
        const contextBlock = formatContextForInjection(summary);
        
        const originalPrompt = output.args.prompt as string || '';
        output.args.prompt = `${contextBlock}\n\n[TASK]\n${originalPrompt}`;
        
        debugLog('Injected context into subagent prompt');
      }
    }
    
    // Quick profile bypasses enforcement
    if (enforcementLevel === 'none') {
      return;
    }
    
    // Context confirmed - allow all tools
    if (state.contextConfirmed) {
      return;
    }
    
    // Check Phase 0 blocking rules
    const { blocked, reason, details } = shouldBlockInPhase0(input.tool, output.args);
    
    if (blocked && reason) {
      if (enforcementLevel === 'full') {
        debugLog(`Phase 0 BLOCKED: ${input.tool}`);
        throw new Error(createPhase0BlockMessage(reason, details));
      } else {
        debugLog(`Phase 0 WARNING: ${input.tool} - ${reason}`);
        return;
      }
    }
    
    if (enforcementLevel === 'full') {
      debugLog(`Phase 0 ALLOWED: ${input.tool}`);
    }
  };
}

/**
 * Creates a post-tool-execution hook that records verification steps and context events.
 *
 * Setu plugin operates exclusively within Setu agent mode.
 * When not in Setu agent, this hook remains silent.
 *
 * Calls `markVerificationStep` when bash command output or titles indicate build, test, or lint activity.
 * When a `ContextCollector` is available it records file reads and grep/glob searches (pattern and result count).
 *
 * @param markVerificationStep - Callback invoked with a verification step ('build' | 'test' | 'lint') when the hook detects the corresponding command.
 * @param getContextCollector - Optional function that returns a `ContextCollector` used to record file reads and search actions; if omitted or it returns `null`, context tracking is disabled.
 * @param getCurrentAgent - Optional accessor for the current agent identifier; if not 'setu', hook does nothing.
 */
export function createToolExecuteAfterHook(
  markVerificationStep: (step: VerificationStep) => void,
  getContextCollector?: () => ContextCollector | null,
  getCurrentAgent?: () => string
) {
  return async (
    input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
    output: { title: string; output: string; metadata: unknown }
  ): Promise<void> => {
    // Only operate when in Setu agent mode
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    if (currentAgent.toLowerCase() !== 'setu') {
      return;
    }
    
    const collector = getContextCollector ? getContextCollector() : null;
    
    // Track file reads for context collection
    if (input.tool === 'read' && collector) {
      const filePath = input.args?.filePath as string;
      if (filePath) {
        collector.recordFileRead(filePath);
        debugLog(`Context: Recorded file read: ${filePath}`);
      }
    }
    
    // Track grep searches for context collection
    if (input.tool === 'grep' && collector) {
      const pattern = input.args?.pattern as string;
      if (pattern) {
        // Try to count results from output
        const lines = output.output.split('\n').filter(l => l.trim());
        collector.recordSearch(pattern, 'grep', lines.length);
        debugLog(`Context: Recorded grep search: ${pattern}`);
      }
    }
    
    // Track glob searches for context collection
    if (input.tool === 'glob' && collector) {
      const pattern = input.args?.pattern as string;
      if (pattern) {
        // Try to count results from output
        const lines = output.output.split('\n').filter(l => l.trim());
        collector.recordSearch(pattern, 'glob', lines.length);
        debugLog(`Context: Recorded glob search: ${pattern}`);
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
      debugLog('Verification step tracked: build');
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
      debugLog('Verification step tracked: test');
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
      debugLog('Verification step tracked: lint');
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