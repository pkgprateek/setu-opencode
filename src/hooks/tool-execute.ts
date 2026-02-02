/**
 * Tool execute hooks - Track verification steps and attempt limits
 * 
 * Uses: tool.execute.before, tool.execute.after
 * 
 * - tool.execute.before: Phase 0 blocking (pre-emptive enforcement)
 *   Context injection for subagent prompts (task tool)
 *   Constraint enforcement (READ_ONLY, NO_PUSH, etc.)
 *   Secrets detection for write/edit operations
 * - tool.execute.after: Tracks verification steps, file reads, searches
 */

import { basename } from 'path';
import {
  shouldBlockInPhase0,
  createPhase0BlockMessage,
  type Phase0State
} from '../enforcement';
import { type ContextCollector, formatContextForInjection, contextToSummary } from '../context';
import { loadActiveTask, shouldBlockDueToConstraint } from '../context/active';
import { type SetuProfile, getProfileEnforcementLevel } from '../prompts/profiles';
import { debugLog } from '../debug';
import { isString, getStringProp } from '../utils';
import { isReadOnlyTool, PARALLEL_BATCH_WINDOW_MS } from '../constants';
import { 
  detectSecrets, 
  validateFilePath,
  logSecurityEvent,
  SecurityEventType,
  type SecretMatch
} from '../security';

// ============================================================================
// Verification Step Tracking
// ============================================================================

/**
 * Verification step tracking
 */
export type VerificationStep = 'build' | 'test' | 'lint' | 'typecheck' | 'visual';

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
 * @param setuProfile - The Setu profile (ultrathink/quick/collab)
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
    default:
      return 'full';    // Safe default: full enforcement
  }
}

/**
 * Determines enforcement level based on the current agent.
 * 
 * @deprecated Use getSetuEnforcementLevel with a SetuProfile instead.
 * This function returns hardcoded 'full' for 'setu' agent and 'none' otherwise.
 * Kept for backwards compatibility only.
 */
export function getEnforcementLevel(currentAgent: string): EnforcementLevel {
  if (currentAgent.toLowerCase() === 'setu') {
    return 'full';
  }
  return 'none';
}

/**
 * Verification state accessor type
 */
export interface VerificationState {
  complete: boolean;
  stepsRun: Set<VerificationStep>;
}

/**
 * Git commit/push command patterns for interception
 */
const GIT_COMMIT_PATTERN = /\bgit\b(?:\s+[-\w.=\/]+)*\s+commit\b/i;
const GIT_PUSH_PATTERN = /\bgit\b(?:\s+[-\w.=\/]+)*\s+push\b/i;

/**
 * Package manifest and critical config file patterns for dependency safety
 * Blocks direct edits to these files to prevent accidental corruption
 * 
 * Extended to cover:
 * - Package manifests (package.json, lockfiles)
 * - Package manager configs (.npmrc, .yarnrc) - can add malicious registries
 * - Build configs with executable code (eslint, babel, webpack, vite)
 */
const PACKAGE_MANIFEST_PATTERNS = [
  // Package manifests
  /package\.json$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb$/,
  
  // Package manager configs (can add malicious registries)
  /\.npmrc$/,
  /\.yarnrc$/,
  /\.yarnrc\.yml$/,
  
  // Build configs with executable code (run during build/lint)
  // Note: Only JS/TS configs that execute code; JSON configs are safer
  /\.eslintrc\.(js|cjs|mjs)$/,
  /eslint\.config\.(js|cjs|mjs|ts)$/,
  /babel\.config\.(js|cjs|mjs|ts)$/,
  /\.babelrc\.(js|cjs|mjs)$/,
  /webpack\.config\.(js|cjs|mjs|ts)$/,
  /vite\.config\.(js|cjs|mjs|ts)$/,
  /rollup\.config\.(js|cjs|mjs|ts)$/,
  /postcss\.config\.(js|cjs|mjs)$/,
  /tailwind\.config\.(js|cjs|mjs|ts)$/,
  
  // Pre/post scripts (shell injection risk)
  /\.husky\//,
  /\.git\/hooks\//,
] as const;

/**
 * Create a before-execution hook that enforces Phase 0 rules for tool execution.
 *
 * Setu plugin operates exclusively within Setu agent mode.
 * When not in Setu agent, this hook remains silent.
 * When in Setu agent, enforces Phase 0 based on the current profile.
 * Also enforces active task constraints (READ_ONLY, NO_PUSH, etc.)
 * Also enforces Git Discipline: requires verification before commit/push.
 *
 * @param getPhase0State - Accessor that returns the current Phase 0 state
 * @param getCurrentAgent - Optional accessor for the current agent identifier; defaults to "setu" when omitted
 * @param getContextCollector - Optional accessor for a ContextCollector used to obtain and format confirmed context for injection
 * @param getSetuProfile - Optional accessor for the current Setu profile (used for profile-level enforcement when in Setu mode)
 * @param getProjectDir - Optional accessor for project directory (used for constraint loading)
 * @param getVerificationState - Optional accessor for verification state (used for git discipline enforcement)
 * @returns A hook function invoked before tool execution that enforces Phase 0 rules and may throw an Error when a tool is blocked under full enforcement
 */
export function createToolExecuteBeforeHook(
  getPhase0State: () => Phase0State,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getSetuProfile?: () => SetuProfile,
  getProjectDir?: () => string,
  getVerificationState?: () => VerificationState
): (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => Promise<void> {
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
        
        // Use type guard instead of unsafe cast
        const originalPrompt = getStringProp(output.args, 'prompt') ?? '';
        output.args.prompt = `${contextBlock}\n\n[TASK]\n${originalPrompt}`;
        
        debugLog('Injected context into subagent prompt');
      }
    }
    
    // GIT DISCIPLINE ENFORCEMENT
    // Block git commit/push if verification is not complete
    // This applies in Setu mode regardless of Phase 0 state
    if (input.tool === 'bash' && getVerificationState && enforcementLevel === 'full') {
      const command = getStringProp(output.args, 'command') ?? '';
      const verificationState = getVerificationState();
      
      // Check for git commit
      if (GIT_COMMIT_PATTERN.test(command) && !verificationState.complete) {
        debugLog('Git Discipline BLOCKED: git commit without verification');
        throw new Error(
          `🚫 [Git Discipline] Verification required before commit.\n\n` +
          `Run verification first:\n` +
          `  • Use \`setu_verify\` tool, OR\n` +
          `  • Run build + test manually\n\n` +
          `Current status: ${verificationState.stepsRun.size === 0 ? 'No verification steps run' : `Completed: ${[...verificationState.stepsRun].join(', ')}`}`
        );
      }
      
      // Check for git push
      if (GIT_PUSH_PATTERN.test(command) && !verificationState.complete) {
        debugLog('Git Discipline BLOCKED: git push without verification');
        throw new Error(
          `🚫 [Git Discipline] Verification required before push.\n\n` +
          `Ensure build and tests pass before pushing.\n\n` +
          `Current status: ${verificationState.stepsRun.size === 0 ? 'No verification steps run' : `Completed: ${[...verificationState.stepsRun].join(', ')}`}`
        );
      }
    }
    
    // DEPENDENCY SAFETY ENFORCEMENT
    // Block direct edits to package manifests to prevent accidental corruption
    // Applies to: package.json, lockfiles
    // Reason: Direct edits can corrupt manifests; use package managers instead
    if ((input.tool === 'write' || input.tool === 'edit') && enforcementLevel === 'full') {
      const filePath = getStringProp(output.args, 'filePath') ?? '';
      
      // Normalize path separators for cross-platform pattern matching (Windows uses backslash)
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      const isPackageManifest = PACKAGE_MANIFEST_PATTERNS.some(pattern => 
        pattern.test(normalizedPath)
      );
      
      if (isPackageManifest) {
        const projectDir = getProjectDir ? getProjectDir() : process.cwd();
        logSecurityEvent(
          projectDir,
          SecurityEventType.DEPENDENCY_EDIT_BLOCKED,
          `Blocked ${input.tool} to ${basename(filePath)}`,
          { sessionId: input.sessionID, tool: input.tool }
        );
        debugLog(`Dependency Safety BLOCKED: ${input.tool} to ${filePath}`);
        throw new Error(
          `⚠️ [Dependency Safety] Direct edits to '${basename(filePath)}' blocked.\n\n` +
          `Package manifests should be modified via package manager commands:\n` +
          `  • npm/pnpm/yarn/bun install <package>\n` +
          `  • npm/pnpm/yarn/bun remove <package>\n\n` +
          `If you need to edit this file directly, explain why to the user first.`
        );
      }
      
      // PATH TRAVERSAL PREVENTION
      // Validate file paths are within project directory
      if (getProjectDir) {
        const projectDir = getProjectDir();
        const pathValidation = validateFilePath(projectDir, filePath, { 
          allowSensitive: false,
          allowAbsoluteWithinProject: true 
        });
        
        if (!pathValidation.valid) {
          logSecurityEvent(
            projectDir,
            pathValidation.reason === 'traversal' 
              ? SecurityEventType.PATH_TRAVERSAL_BLOCKED
              : SecurityEventType.SENSITIVE_FILE_BLOCKED,
            pathValidation.error || `Blocked ${input.tool} to ${filePath}`,
            { sessionId: input.sessionID, tool: input.tool }
          );
          debugLog(`Path Security BLOCKED: ${pathValidation.error}`);
          throw new Error(`🛡️ [Path Security] ${pathValidation.error}`);
        }
      }
      
      // SECRETS DETECTION
      // Scan content for accidental secrets before write/edit
      const content = getStringProp(output.args, input.tool === 'write' ? 'content' : 'newString');
      if (content) {
        const secrets: SecretMatch[] = detectSecrets(content);
        const criticalSecrets = secrets.filter((s: SecretMatch) => s.severity === 'critical' || s.severity === 'high');
        
        if (criticalSecrets.length > 0) {
          const projectDir = getProjectDir ? getProjectDir() : process.cwd();
          logSecurityEvent(
            projectDir,
            SecurityEventType.SECRETS_DETECTED,
            `Detected ${criticalSecrets.length} secret(s) in ${input.tool} to ${filePath}: ${criticalSecrets.map((s: SecretMatch) => s.name).join(', ')}`,
            { sessionId: input.sessionID, tool: input.tool }
          );
          debugLog(`Secrets DETECTED: ${criticalSecrets.length} in ${filePath}`);
          throw new Error(
            `🔐 [Secrets Detected] Cannot ${input.tool} - content contains sensitive data:\n\n` +
            criticalSecrets.map((s: SecretMatch) => `  • ${s.name} (${s.severity})${s.line ? ` at line ${s.line}` : ''}`).join('\n') +
            `\n\nPlease remove secrets before writing. Use environment variables instead.`
          );
        }
      }
    }
    
    // CONSTRAINT ENFORCEMENT
    // Check active task constraints BEFORE Phase 0 check
    // Constraints apply even after context is confirmed
    if (getProjectDir) {
      const projectDir = getProjectDir();
      const activeTask = loadActiveTask(projectDir);
      
      if (activeTask && activeTask.status === 'in_progress' && activeTask.constraints.length > 0) {
        const { blocked, reason, constraint } = shouldBlockDueToConstraint(
          input.tool,
          activeTask.constraints,
          output.args
        );
        
        if (blocked && reason) {
          debugLog(`Constraint BLOCKED: ${input.tool} (${constraint})`);
          throw new Error(`[Constraint: ${constraint}] ${reason}`);
        }
      }
    }
    
    // Quick profile bypasses Phase 0 enforcement (but NOT constraint enforcement above)
    if (enforcementLevel === 'none') {
      return;
    }
    
    // Context confirmed - allow all tools (Phase 0 complete)
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
 * Calls `markVerificationStep` when bash command output or titles indicate build, test, lint, or typecheck activity.
 * When a `ContextCollector` is available it records file reads and grep/glob searches (pattern and result count).
 *
 * Note: The 'visual' step is not auto-detected — it requires manual invocation via the setu_verify tool
 * with `steps: ['visual']`. This prompts the user to visually verify UI correctness.
 *
 * @param markVerificationStep - Callback invoked with a verification step ('build' | 'test' | 'lint' | 'typecheck' | 'visual') when the hook detects the corresponding command.
 * @param getCurrentAgent - Optional accessor for the current agent identifier; if not 'setu', hook does nothing.
 * @param getContextCollector - Optional function that returns a `ContextCollector` used to record file reads and search actions; if omitted or it returns `null`, context tracking is disabled.
 */
/**
 * Count non-empty lines in output string
 */
const countResultLines = (output: string): number =>
  output.split('\n').filter(l => l.trim()).length;

export function createToolExecuteAfterHook(
  markVerificationStep: (step: VerificationStep) => void,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null
): (
  input: { tool: string; sessionID: string; callID: string; args?: Record<string, unknown> },
  output: { title: string; output: string; metadata: unknown }
) => Promise<void> {
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
    // WRITE-THROUGH with debounce: Batches rapid parallel reads
    if (input.tool === 'read' && collector) {
      // Use type guard instead of unsafe cast
      const filePath = getStringProp(input.args, 'filePath');
      if (filePath) {
        collector.recordFileRead(filePath);
        debugLog(`Context: Recorded file read: ${filePath}`);
        
        // Debounced persistence - batches parallel reads into single write
        try {
          collector.debouncedSave();
        } catch (err) {
          debugLog('Context: Failed to queue debounced save:', err);
        }
      }
    }
    
    // Track grep searches for context collection
    // WRITE-THROUGH with debounce: Batches rapid parallel searches
    if (input.tool === 'grep' && collector) {
      // Use type guard instead of unsafe cast
      const pattern = getStringProp(input.args, 'pattern');
      if (pattern) {
        collector.recordSearch(pattern, 'grep', countResultLines(output.output));
        debugLog(`Context: Recorded grep search: ${pattern}`);
        
        // Debounced persistence
        try {
          collector.debouncedSave();
        } catch (err) {
          debugLog('Context: Failed to queue debounced save:', err);
        }
      }
    }
    
    // Track glob searches for context collection
    // WRITE-THROUGH with debounce: Batches rapid parallel searches
    if (input.tool === 'glob' && collector) {
      // Use type guard instead of unsafe cast
      const pattern = getStringProp(input.args, 'pattern');
      if (pattern) {
        collector.recordSearch(pattern, 'glob', countResultLines(output.output));
        debugLog(`Context: Recorded glob search: ${pattern}`);
        
        // Debounced persistence
        try {
          collector.debouncedSave();
        } catch (err) {
          debugLog('Context: Failed to queue debounced save:', err);
        }
      }
    }
    
    // Only track verification for bash tool executions
    if (input.tool !== 'bash') return;
    
    // Ensure output.output is a string before calling toLowerCase
    const commandOutput = isString(output.output) ? output.output.toLowerCase() : '';
    const title = isString(output.title) ? output.title.toLowerCase() : '';
    
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
    
    // Detect typecheck commands
    if (
      title.includes('typecheck') ||
      title.includes('type-check') ||
      title.includes('type check') ||
      commandOutput.includes('tsc --noemit') ||
      commandOutput.includes('tsc -noemit') ||
      commandOutput.includes('npm run typecheck') ||
      commandOutput.includes('pnpm typecheck') ||
      commandOutput.includes('yarn typecheck') ||
      commandOutput.includes('bun run typecheck') ||
      commandOutput.includes('mypy') ||
      commandOutput.includes('pyright') ||
      commandOutput.includes('cargo check') ||
      commandOutput.includes('cargo clippy')
    ) {
      markVerificationStep('typecheck');
      debugLog('Verification step tracked: typecheck');
    }
    
    // Note: 'visual' step requires manual invocation via setu_verify tool
    // It cannot be auto-detected from bash commands
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

export function createAttemptTracker(): {
  recordAttempt: (taskId: string, approach: string) => number;
  getAttempts: (taskId: string) => AttemptState | undefined;
  shouldAskForGuidance: (taskId: string) => boolean;
  getGuidanceMessage: (taskId: string) => string | null;
  reset: (taskId: string) => void;
  clearAll: () => void;
} {
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

// ============================================================================
// Parallel Execution Tracking
// ============================================================================

/**
 * Represents an in-flight batch of tool executions within a time window.
 * 
 * When multiple read-only tools execute within PARALLEL_BATCH_WINDOW_MS,
 * they're grouped into a single batch for audit logging.
 */
export interface ToolExecutionBatch {
  /** Tools executed in this batch */
  toolNames: string[];
  /** When the first tool in the batch executed */
  batchStartedAt: number;
  /** Timer that triggers batch completion */
  completionTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Active batches indexed by session ID.
 * This type is exposed for the plugin to manage state in its closure.
 */
export type ActiveBatchesMap = Map<string, ToolExecutionBatch>;

/**
 * Creates a new active batches map for session-isolated tracking.
 * Call this from the plugin closure to create state.
 */
export function createActiveBatchesMap(): ActiveBatchesMap {
  return new Map();
}

/**
 * Completes a batch and logs parallel execution stats.
 * 
 * Only logs when 2+ read-only tools executed in parallel (the interesting case).
 * Single-tool batches are silently discarded.
 */
function completeAndLogBatch(activeBatches: ActiveBatchesMap, sessionId: string): void {
  const batch = activeBatches.get(sessionId);
  if (batch && batch.toolNames.length > 1) {
    debugLog(`Parallel execution: ${batch.toolNames.length} tools in batch [${batch.toolNames.join(', ')}]`);
  }
  activeBatches.delete(sessionId);
}

/**
 * Records a tool execution for parallel tracking.
 * 
 * Uses isReadOnlyTool() from constants module as the single source
 * of truth for which tools can be parallelized. This ensures the tracking
 * list cannot drift from the enforcement list.
 * 
 * @param activeBatches - The active batches map from plugin state
 * @param sessionId - Current session ID for isolation
 * @param toolName - Name of the tool being executed
 */
export function recordToolExecution(
  activeBatches: ActiveBatchesMap,
  sessionId: string,
  toolName: string
): void {
  // Only track read-only tools (the parallelizable ones)
  if (!isReadOnlyTool(toolName)) {
    return;
  }

  const now = Date.now();
  let batch = activeBatches.get(sessionId);

  // Start new batch if none exists
  if (!batch) {
    batch = {
      toolNames: [toolName],
      batchStartedAt: now,
      completionTimer: setTimeout(() => completeAndLogBatch(activeBatches, sessionId), PARALLEL_BATCH_WINDOW_MS)
    };
    activeBatches.set(sessionId, batch);
    return;
  }

  // Add to existing batch and reset the completion timer
  batch.toolNames.push(toolName);
  if (batch.completionTimer) {
    clearTimeout(batch.completionTimer);
  }
  batch.completionTimer = setTimeout(() => completeAndLogBatch(activeBatches, sessionId), PARALLEL_BATCH_WINDOW_MS);
}

/**
 * Disposes the batch tracker for a session.
 * 
 * Call this when a session ends to prevent timer leaks.
 */
export function disposeSessionBatch(activeBatches: ActiveBatchesMap, sessionId: string): void {
  const batch = activeBatches.get(sessionId);
  if (batch?.completionTimer) {
    clearTimeout(batch.completionTimer);
  }
  activeBatches.delete(sessionId);
}
