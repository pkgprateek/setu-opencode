/**
 * Tool execute hooks - Track verification steps and attempt limits
 * 
 * Uses: tool.execute.before, tool.execute.after
 * 
 * - tool.execute.before: Discipline and gear enforcement
 *   Context injection for subagent prompts (task tool)
 *   Constraint enforcement (READ_ONLY, NO_PUSH, etc.)
 *   Secrets detection for write/edit operations
 * - tool.execute.after: Tracks verification steps, file reads, searches
 */

import { basename, isAbsolute, normalize, resolve } from 'path';
import { existsSync } from 'fs';
import {
  determineGear,
  shouldBlockInPhase0,
  createPhase0BlockMessage,
  shouldBlock as shouldBlockByGear,
  createGearBlockMessage,
  type Phase0State,
} from '../enforcement';
import {
  type ContextCollector,
  formatContextForInjection,
  contextToSummary,
  getDisciplineState,
  setQuestionBlocked,
  clearQuestionBlocked,
  setOverwriteRequirement,
  getOverwriteRequirement,
  clearOverwriteRequirement,
  setPendingSafetyConfirmation,
  getPendingSafetyConfirmation,
  approvePendingSafetyConfirmation,
  denyPendingSafetyConfirmation,
  clearPendingSafetyConfirmation,
} from '../context';
import { loadActiveTask, shouldBlockDueToConstraint } from '../context/active';
import { debugLog } from '../debug';
import { isString, getStringProp, getCurrentBranch, isProtectedBranch, formatGuidanceMessage } from '../utils';
import { isReadOnlyTool, PARALLEL_BATCH_WINDOW_MS } from '../constants';
import { 
  detectSecrets, 
  validateFilePath,
  logSecurityEvent,
  SecurityEventType,
  type SecretMatch
} from '../security';
import { classifyHardSafety } from '../security/safety-classifier';
import { sanitizeArgs } from '../utils/error-handling';
import { detectEnvironmentConflict } from '../environment/detector';

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

function normalizeForComparison(projectDir: string, filePath: string): string {
  const resolvedPath = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(projectDir, filePath);
  return normalize(resolvedPath);
}

function hasReadTargetFile(collector: ContextCollector | null, projectDir: string, targetFilePath: string): boolean {
  if (!collector) return false;

  const target = normalizeForComparison(projectDir, targetFilePath);
  const filesRead = collector.getContext().filesRead;

  return filesRead.some((entry) => {
    const candidate = normalizeForComparison(projectDir, entry.path);
    return candidate === target;
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
  return `{${entries.join(',')}}`;
}

function createActionFingerprint(tool: string, args: Record<string, unknown>): string {
  return `${tool}:${stableStringify(args)}`;
}

type QuestionDecision = 'approved' | 'denied' | 'unknown';

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function getQuestionDecision(output: { title: string; output: string; metadata: unknown }): QuestionDecision {
  const content = `${output.title}\n${output.output}\n${stringifyUnknown(output.metadata)}`.toLowerCase();

  if (content.includes('proceed - i understand the risk')) {
    return 'approved';
  }

  if (content.includes('cancel - use a safer alternative')) {
    return 'denied';
  }

  return 'unknown';
}

/**
 * Create a before-execution hook that enforces Gearbox rules for tool execution.
 *
 * Setu plugin operates exclusively within Setu agent mode.
 * When not in Setu agent, this hook remains silent.
 * When in Setu agent, enforces Gearbox based on artifact existence:
 * - Scout: No RESEARCH.md → read-only
 * - Architect: Has RESEARCH.md but no PLAN.md → .setu/ writes only
 * - Builder: Has both artifacts → all allowed (verification gate separate)
 * 
 * Also enforces active task constraints (READ_ONLY, NO_PUSH, etc.)
 * Also enforces Git Discipline: requires verification before commit/push.
 *
 * @param getCurrentAgent - Optional accessor for the current agent identifier; defaults to "setu" when omitted
 * @param getContextCollector - Optional accessor for a ContextCollector used to obtain and format confirmed context for injection
 * @param getProjectDir - Optional accessor for project directory (used for constraint loading and gear determination)
 * @param getVerificationState - Optional accessor for verification state (used for git discipline enforcement)
 * @returns A hook function invoked before tool execution that enforces Gearbox rules and may throw an Error when a tool is blocked
 */
export function createToolExecuteBeforeHook(
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getProjectDir?: () => string,
  getVerificationState?: () => VerificationState,
  getPhase0State?: () => Phase0State
): (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => Promise<void> {
  // Direct mutation tools only. 'task' is intentionally excluded: it's not a
  // direct mutator, but launches subagents that may mutate. It receives partial
  // blocking (e.g., overwrite guard at line 235) without full mutation treatment.
  const isMutatingToolName = (toolName: string): boolean =>
    ['write', 'edit', 'bash', 'patch', 'multiedit', 'apply_patch'].includes(toolName);

  return async (
    input: ToolExecuteBeforeInput,
    output: ToolExecuteBeforeOutput
  ): Promise<void> => {
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    
    // Only operate when in Setu agent mode
    if (currentAgent.toLowerCase() !== 'setu') {
      return;
    }

    // SECURITY: Sanitize args to prevent control char injection
    // Removes null bytes and control characters that could bypass parsing
    output.args = sanitizeArgs(output.args);
    const projectDir = getProjectDir ? getProjectDir() : process.cwd();
    const collector = getContextCollector ? getContextCollector() : null;
    const disciplineState = getDisciplineState(input.sessionID);
    const isMutating = isMutatingToolName(input.tool);
    const actionFingerprint = createActionFingerprint(input.tool, output.args);

    if (input.tool === 'question') {
      return;
    }

    if (disciplineState.questionBlocked) {
      throw new Error(
        formatGuidanceMessage(
          'Clarification required before continuing',
          disciplineState.questionReason ?? 'A required implementation decision is still unanswered.',
          'Answer the active structured question first.',
          'After clarification, Setu will continue the protocol automatically.'
        )
      );
    }

    if (getPhase0State && !getPhase0State().contextConfirmed) {
      const phase0Result = shouldBlockInPhase0(input.tool, output.args);
      if (phase0Result.blocked) {
        throw new Error(createPhase0BlockMessage(phase0Result.reason, phase0Result.details));
      }
    }

    const pendingOverwrite = getOverwriteRequirement(input.sessionID);

    if (pendingOverwrite?.pending) {
      const requiredPath = pendingOverwrite.filePath;
      const requiredNormalized = normalizeForComparison(projectDir, requiredPath);

      if (input.tool === 'read') {
        const readPath = getStringProp(output.args, 'filePath') ?? '';
        const readNormalized = readPath ? normalizeForComparison(projectDir, readPath) : '';

        if (readNormalized === requiredNormalized) {
          clearOverwriteRequirement(input.sessionID);
          debugLog(`Overwrite gate cleared after read: ${requiredPath}`);
        }
        // Allow all reads to pass through — only the required read clears the gate
      } else {
        if (isMutating || input.tool === 'task') {
          throw new Error(
            formatGuidanceMessage(
              'Overwrite guard active',
              `Pending discipline step: read '${requiredPath}' first.`,
              `Use read on '${requiredPath}' before any further changes.`,
              'Do not use bash/write/edit to bypass this guard.'
            )
          );
        }
      }
    }

    if (isMutating) {
      let consumedApproval = false;
      const pendingSafety = getPendingSafetyConfirmation(input.sessionID);
      if (pendingSafety) {
        if (pendingSafety.status === 'approved' && pendingSafety.actionFingerprint === actionFingerprint) {
          // One-time approval: consume it now. Next retry requires fresh approval.
          clearPendingSafetyConfirmation(input.sessionID);
          consumedApproval = true;
        } else if (pendingSafety.status === 'pending' && pendingSafety.actionFingerprint === actionFingerprint) {
          throw new Error(
            formatGuidanceMessage(
              'Safety confirmation required',
              pendingSafety.reasons.join('; '),
              'Ask the user using question tool with options: Proceed - I understand the risk / Cancel - use a safer alternative.',
              'Use a lower-risk alternative if possible.'
            )
          );
        } else if (pendingSafety.status === 'denied' && pendingSafety.actionFingerprint === actionFingerprint) {
          throw new Error(
            formatGuidanceMessage(
              'Safety confirmation denied',
              pendingSafety.reasons.join('; '),
              'Do not execute this action. Choose a safer alternative or re-ask for explicit approval.',
              'Prefer a local, non-production, non-destructive path.'
            )
          );
        }
      }

      const safetyDecision = classifyHardSafety(input.tool, output.args);
      if (!consumedApproval && safetyDecision.hardSafety) {
        if (safetyDecision.action === 'ask') {
          setPendingSafetyConfirmation(input.sessionID, {
            actionFingerprint,
            reasons: safetyDecision.reasons,
          });
          setQuestionBlocked(
            input.sessionID,
            `Safety confirmation needed: ${safetyDecision.reasons.join('; ')}`
          );
          throw new Error(
            formatGuidanceMessage(
              'Safety confirmation required',
              safetyDecision.reasons.join('; '),
              'Ask the user using question tool with options: Proceed - I understand the risk / Cancel - use a safer alternative.',
              'Use a lower-risk alternative if possible.'
            )
          );
        }

        throw new Error(
          formatGuidanceMessage(
            'Execution paused by safety policy',
            safetyDecision.reasons.join('; '),
            'Do not execute this action. Choose a safer alternative.',
            'Use a lower-risk alternative if possible.'
          )
        );
      }
    }
    
    // Context injection for task tool (subagent prompts)
    if (input.tool === 'task' && getContextCollector) {
      // Use outer collector binding — getContextCollector() returns the same instance
      if (collector && collector.getContext().confirmed) {
        const context = collector.getContext();
        const summary = contextToSummary(context);
        const contextBlock = formatContextForInjection(summary);
        
        // Use type guard instead of unsafe cast
        const originalPrompt = getStringProp(output.args, 'prompt') ?? '';
        output.args.prompt = `${contextBlock}\n\n[TASK]\n${originalPrompt}`;
        
        // SECURITY: Re-sanitize after prompt injection to prevent control-char bypass
        // The injected context could reintroduce control characters
        output.args = sanitizeArgs(output.args);
        
        debugLog('Injected context into subagent prompt');
      }
    }
    
    // GIT DISCIPLINE ENFORCEMENT (Pre-Commit Checklist)
    // Block git commit/push if verification is not complete
    // This applies in Setu mode regardless of gear state
    if (input.tool === 'bash' && getVerificationState) {
      const command = getStringProp(output.args, 'command') ?? '';
      const envConflict = await detectEnvironmentConflict(command);
      if (envConflict.hasConflict) {
        throw new Error(
          formatGuidanceMessage(
            'Potential environment conflict',
            envConflict.reason ?? 'Command can conflict with active development processes.',
            'Stop the dev server first, then run build/verification commands.',
            'If you must continue, run the command manually after confirming local state.'
          )
        );
      }

      const verificationState = getVerificationState();
      
      // Check for git commit - enhanced pre-commit checklist
      if (GIT_COMMIT_PATTERN.test(command)) {
        const branch = getCurrentBranch(projectDir);
        
        if (!verificationState.complete) {
          const activeTask = loadActiveTask(projectDir);
          const branchWarning = isProtectedBranch(branch) 
            ? `  ⚠️ On protected branch: ${branch}\n` 
            : '';
          
          debugLog('Pre-Commit Checklist BLOCKED: git commit without verification');
          throw new Error(
            `🚫 [Pre-Commit Checklist] Verification required.\n\n` +
            `Before committing, please verify:\n` +
            `  1. ✗ Build/test verification not complete\n` +
            `  2. ? Do you understand what was changed?\n` +
            `  3. Branch: ${branch}\n` +
            branchWarning +
            `  4. Task: ${activeTask?.task?.slice(0, 50) || '(none set)'}...\n\n` +
            `Run \`setu_verify\` first.\n\n` +
            `Current status: ${verificationState.stepsRun.size === 0 ? 'No verification steps run' : `Completed: ${[...verificationState.stepsRun].join(', ')}`}`
          );
        }
        
        // Additional warning for complex task on protected branch
        // (non-blocking, just logged for awareness since verification passed)
        const activeTask = loadActiveTask(projectDir);
        if (isProtectedBranch(branch) && activeTask?.task && activeTask.task.length > 50) {
          debugLog(`Pre-Commit: Complex task on protected branch ${branch} - ensure thorough review`);
        }
      }
      
      // Check for git push
      if (GIT_PUSH_PATTERN.test(command) && !verificationState.complete) {
        const branch = getCurrentBranch(projectDir);
        const branchWarning = isProtectedBranch(branch) 
          ? `\n⚠️ Warning: Pushing to protected branch: ${branch}` 
          : '';
        
        debugLog('Pre-Commit Checklist BLOCKED: git push without verification');
        throw new Error(
          `🚫 [Pre-Commit Checklist] Verification required before push.\n\n` +
          `Branch: ${branch}${branchWarning}\n\n` +
          `Ensure build and tests pass before pushing.\n\n` +
          `Current status: ${verificationState.stepsRun.size === 0 ? 'No verification steps run' : `Completed: ${[...verificationState.stepsRun].join(', ')}`}`
        );
      }
    }
    
    // DEPENDENCY SAFETY ENFORCEMENT
    // Block direct edits to package manifests to prevent accidental corruption
    // Applies to: package.json, lockfiles
    // Reason: Direct edits can corrupt manifests; use package managers instead
    if (input.tool === 'write' || input.tool === 'edit') {
      const filePath = getStringProp(output.args, 'filePath') ?? '';
      
      // Normalize path separators for cross-platform pattern matching (Windows uses backslash)
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      const isPackageManifest = PACKAGE_MANIFEST_PATTERNS.some(pattern => 
        pattern.test(normalizedPath)
      );
      
      if (isPackageManifest) {
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

      if ((input.tool === 'write' || input.tool === 'edit') && getProjectDir && filePath) {
        const fileExists = existsSync(normalizeForComparison(projectDir, filePath));
        if (!fileExists && input.tool === 'edit') {
          throw new Error(
            formatGuidanceMessage(
              'File does not exist',
              `Cannot edit '${filePath}' because it does not exist.`,
              `Create '${filePath}' with write first, then read and edit as needed.`,
              'Use write for new files and edit only for existing files.'
            )
          );
        }

        if (fileExists && !hasReadTargetFile(collector, projectDir, filePath)) {
          setOverwriteRequirement(input.sessionID, {
            pending: true,
            filePath,
            createdAt: Date.now(),
          });

          throw new Error(
            formatGuidanceMessage(
              'Read required before overwrite',
              `Target file already exists: '${filePath}'.`,
              `Read '${filePath}' first, then update it.`,
              'Use edit for in-place updates after reading the file.'
            )
          );
        }
      }
      
      // SECRETS DETECTION
      // Scan content for accidental secrets before write/edit
      const content = getStringProp(output.args, input.tool === 'write' ? 'content' : 'newString');
      if (content) {
        const secrets: SecretMatch[] = detectSecrets(content);
        const criticalSecrets = secrets.filter((s: SecretMatch) => s.severity === 'critical' || s.severity === 'high');
        
        if (criticalSecrets.length > 0) {
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
    // Check active task constraints BEFORE Gearbox check
    // Constraints apply regardless of gear
    if (getProjectDir) {
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

    // GEARBOX ENFORCEMENT
    // Determines gear based on artifact existence:
    // - Scout: No RESEARCH.md → read-only tools only
    // - Architect: Has RESEARCH.md but no PLAN.md → .setu/ writes only
    // - Builder: Has both → all allowed (verification gate is separate)
    if (getProjectDir) {
      const gearState = determineGear(projectDir);
      const gearBlockResult = shouldBlockByGear(gearState.current, input.tool, output.args);

      if (gearBlockResult.blocked) {
        debugLog(`Gearbox BLOCKED: ${input.tool} in ${gearState.current} gear`);
        logSecurityEvent(
          projectDir,
          SecurityEventType.GEAR_BLOCKED,
          `Blocked ${input.tool} in ${gearState.current} gear (${gearBlockResult.reason || 'no reason'})`,
          { sessionId: input.sessionID, tool: input.tool }
        );
        throw new Error(
          formatGuidanceMessage(
            'Execution paused by gear policy',
            createGearBlockMessage(gearBlockResult),
            'Create required artifacts or confirm a reduced-scope request.',
            'Use setu_research first, then setu_plan when needed.'
          )
        );
      }

      debugLog(`Gearbox ALLOWED: ${input.tool} in ${gearState.current} gear`);
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

    if (input.tool === 'question') {
      clearQuestionBlocked(input.sessionID);

      const pendingSafety = getPendingSafetyConfirmation(input.sessionID);
      if (pendingSafety) {
        const decision = getQuestionDecision(output);
        if (decision === 'approved') {
          approvePendingSafetyConfirmation(input.sessionID, pendingSafety.actionFingerprint);
          debugLog('Safety confirmation approved by user');
        } else if (decision === 'denied') {
          denyPendingSafetyConfirmation(input.sessionID, pendingSafety.actionFingerprint);
          debugLog('Safety confirmation denied by user');
        } else {
          denyPendingSafetyConfirmation(input.sessionID, pendingSafety.actionFingerprint);
          debugLog('Safety confirmation unresolved; defaulting to denied');
        }
      }

      debugLog('Question answered; cleared question block');
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
        } catch (err: unknown) {
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
