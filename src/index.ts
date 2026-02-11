/**
 * Setu - OpenCode Plugin
 * 
 * A master craftsman persona that transforms AI into a thoughtful, expert colleague.
 * 
 * Features:
 * - Enforcement: Phase 0 blocking, verification before completion
 * - Context persistence: .setu/ directory for session continuity
 * - Skills: Bootstrap, verification, rules creation, code quality, and more
 * 
 * @see https://github.com/pkgprateek/setu-opencode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createSystemTransformHook,
  createChatMessageHook,
  createToolExecuteBeforeHook,
  createToolExecuteAfterHook,
  createEventHook,
  createCompactionHook,
  createActiveBatchesMap,
  recordToolExecution,
  type VerificationStep
} from './hooks';
import { createEnhancedAttemptTracker } from './enforcement';
import { recordFailedApproach } from './context';
import { createSetuVerifyTool } from './tools/setu-verify';
import { createSetuContextTool } from './tools/setu-context';
import { createSetuFeedbackTool } from './tools/setu-feedback';
import { createSetuTaskTool } from './tools/setu-task';
import { createSetuResearchTool } from './tools/setu-research';
import { createSetuPlanTool } from './tools/setu-plan';
import { createSetuResetTool } from './tools/setu-reset';
import { createSetuDoctorTool } from './tools/setu-doctor';
import { createSetuAgent } from './agent/setu-agent';
import { 
  initializeFeedbackFile, 
  createContextCollector,
  type ContextCollector,
  type ProjectRules
} from './context';
import { debugLog, alwaysLog, errorLog } from './debug';
import { type FileAvailability } from './prompts/persona';
import { wrapHook } from './utils/error-handling';

// Plugin state
interface SetuState {
  currentAgent: string;
  isFirstSession: boolean;
  verificationSteps: Set<VerificationStep>;
  verificationComplete: boolean;
  phase0: {
    contextConfirmed: boolean;
    sessionId: string;
    startedAt: number;
  };
  contextCollector: ContextCollector | null;
  projectRules: ProjectRules | null;  // Silent Exploration: loaded on session start
  projectDir: string;  // Project root directory for JIT context injection

  // File existence tracking (checked silently, no auto-read)
  setuFilesExist: {
    active: boolean;       // .setu/active.json
    context: boolean;      // .setu/context.json
    agentsMd: boolean;     // AGENTS.md
    claudeMd: boolean;     // CLAUDE.md
  };

  // Cache for file existence checks (avoids repeated fs.existsSync)
  fileCache: Map<string, { exists: boolean; checkedAt: number }>;
}

/**
 * Setu Plugin for OpenCode
 * 
 * Uses available hooks from the OpenCode Plugin API:
 * - config: Set default_agent to "setu"
 * - experimental.chat.system.transform: Inject persona into system prompt
  * - chat.message: Track current agent
 * - tool.execute.before: Phase 0 enforcement (block side-effects until context confirmed)
 * - tool.execute.after: Track verification steps, file reads, searches
 * - event: Handle session lifecycle, load context on start
 * - tool: Custom tools (setu_verify, setu_context, setu_feedback, lsp_*)
 */
export const SetuPlugin: Plugin = async (ctx) => {
  // Create the Setu agent configuration file on plugin init
  // This creates .opencode/agents/setu.md with the Setu persona and permissions
  const projectDir = ctx.directory || process.cwd();
  try {
    const created = await createSetuAgent(projectDir);
    if (created) {
      alwaysLog('Agent configuration updated. Restart may be required if Setu is missing from Tab cycle.');
    }
  } catch (error) {
    errorLog('Failed to create agent config:', error);
  }
  
  // Initialize feedback file for transparency
  try {
    initializeFeedbackFile(projectDir);
  } catch (error) {
    // Non-critical - only log in debug mode
    debugLog('Could not initialize feedback file:', error);
  }
  
  // Create context collector for .setu/ persistence
  // Context is created but loaded only when context file exists
  let contextCollector: ContextCollector | null = null;
  try {
    contextCollector = createContextCollector(projectDir);
    debugLog('Context collector initialized');
  } catch (error) {
    debugLog('Could not initialize context collector:', error);
  }
  
  // Project directory accessor for tools
  const getProjectDir = () => projectDir;
  
  // Initialize state
  const state: SetuState = {
    currentAgent: 'setu', // Default to setu since we set it as default_agent
    isFirstSession: true,
    verificationSteps: new Set(),
    verificationComplete: false,
    phase0: {
      contextConfirmed: false,
      sessionId: '',
      startedAt: Date.now()
    },
    contextCollector,
    projectRules: null,  // Loaded on session start via Silent Exploration
    projectDir,  // Project root directory for JIT context injection

    // File existence flags - checked silently, no errors on first run
    setuFilesExist: {
      active: false,
      context: false,
      agentsMd: false,
      claudeMd: false
    },

    // File cache (avoids repeated fs calls)
    fileCache: new Map()
  };
  
  // Create attempt tracker for "3 tries then suggest gear shift" pattern
  const attemptTracker = createEnhancedAttemptTracker({
    maxAttempts: 3,
    // Persist failed approaches to active.json for ghost loop prevention
    onFailedApproach: (approach: string) => recordFailedApproach(projectDir, approach)
  });
  
  // Create active batches map for parallel execution tracking (audit trail)
  const activeBatches = createActiveBatchesMap();
  
  // State accessors
  
  // Cached file existence checker (silent, no errors)
  // Cache lasts 5 seconds to avoid repeated fs.existsSync calls
  const checkFileExists = (filePath: string): boolean => {
    const cached = state.fileCache.get(filePath);
    const now = Date.now();
    
    // Return cached result if less than 5 seconds old
    if (cached && (now - cached.checkedAt < 5000)) {
      return cached.exists;
    }
    
    // Check file existence and update cache
    const exists = existsSync(filePath);
    state.fileCache.set(filePath, { exists, checkedAt: now });
    
    return exists;
  };
  
  // File existence checker for all Setu files (uses cache)
  // Updates and returns file existence status for all Setu files (uses cache)
  const refreshSetuFilesExist = (): FileAvailability => {
    state.setuFilesExist = {
      active: checkFileExists(join(projectDir, '.setu', 'active.json')),
      context: checkFileExists(join(projectDir, '.setu', 'context.json')),
      agentsMd: checkFileExists(join(projectDir, 'AGENTS.md')),
      claudeMd: checkFileExists(join(projectDir, 'CLAUDE.md'))
    };
    
    return state.setuFilesExist;
  };
  
  const getCurrentAgent = () => state.currentAgent;
  const setCurrentAgent = (agent: string) => {
    if (agent !== state.currentAgent) {
      debugLog(`Agent changed: ${state.currentAgent} → ${agent}`);
      state.currentAgent = agent;
    }
  };
  
  const getPhase0State = () => state.phase0;
  const confirmContext = () => {
    state.phase0.contextConfirmed = true;
    debugLog('Phase 0: Context confirmed - side-effect tools now allowed');
  };
  const resetPhase0 = (sessionId: string) => {
    state.phase0 = {
      contextConfirmed: false,
      sessionId,
      startedAt: Date.now()
    };
    debugLog('Phase 0: Reset for new session');
  };
  
  const getContextCollector = (): ContextCollector | null => state.contextCollector;
  
  const getProjectRules = (): ProjectRules | null => state.projectRules;
  const setProjectRules = (rules: ProjectRules | null) => {
    state.projectRules = rules;
    if (rules) {
      debugLog('Silent Exploration: Project rules loaded');
    }
  };
  
  const getVerificationState = () => ({
    complete: state.verificationComplete,
    stepsRun: state.verificationSteps
  });
  
  const markVerificationStep = (step: VerificationStep) => {
    state.verificationSteps.add(step);
    // Consider verified if build and test have run
    if (state.verificationSteps.has('build') && state.verificationSteps.has('test')) {
      state.verificationComplete = true;
    }
  };
  
  const resetVerificationState = () => {
    state.verificationSteps.clear();
    state.verificationComplete = false;
  };
  
  const markVerificationComplete = () => {
    state.verificationComplete = true;
  };
  
  const setFirstSessionDone = () => {
    state.isFirstSession = false;
  };
  
  // Log plugin initialization (only in debug mode)
  debugLog('Plugin initialized');
  debugLog('Default mode: Setu (discipline layer)');
  debugLog('Phase 0 enforcement: ACTIVE');
  debugLog('Context persistence: .setu/ directory');
  debugLog('Tools: setu_verify, setu_context, setu_feedback, setu_task');
  debugLog('Skills bundled: setu-bootstrap, setu-verification, setu-rules-creation');

  // Create tool.before hook once so session-scoped policy state persists correctly.
  const beforeHook = createToolExecuteBeforeHook(
    getCurrentAgent,
    getContextCollector,
    getProjectDir,
    getVerificationState
  );
  
  return {
    // Set Setu as the default agent
    // This hook receives the config and can modify it
    config: async (input: { default_agent?: string; [key: string]: unknown }) => {
      // Only set if not already configured by user
      if (!input.default_agent) {
        input.default_agent = 'setu';
        debugLog('Set as default agent');
      } else {
        debugLog(`User configured default_agent: ${input.default_agent}`);
      }
    },
    
    // Inject Setu persona into system prompt
    // Only injects when in Setu agent - silent in Build/Plan
    // Now also injects loaded context content (summary, constraints)
    // AND Silent Exploration project rules (AGENTS.md, CLAUDE.md, active task)
    // Wrapped for graceful degradation (2.10)
    'experimental.chat.system.transform': wrapHook(
      'system.transform',
      createSystemTransformHook(
        getVerificationState,
        () => state.setuFilesExist, // Pass file existence for lazy loading
        getCurrentAgent,
        getContextCollector, // Pass context collector for content injection
        getProjectRules,      // Pass project rules for Silent Exploration injection
        () => state.projectDir // Pass project directory for JIT context injection
      )
    ),
    
    // Track current agent
    // Wrapped for graceful degradation (2.10)
    'chat.message': wrapHook(
      'chat.message',
      createChatMessageHook(setCurrentAgent)
    ),
    
    // Phase 0: Block side-effect tools until context is confirmed
    // Consolidated enforcement (agent + policy)
    // Also enforces active task constraints (READ_ONLY, NO_PUSH, etc.)
    // Also enforces Git Discipline (verification before commit/push)
    // Also records tool execution for parallel tracking (audit trail)
    'tool.execute.before': async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown> }
    ) => {
      // Record for parallel execution tracking (debug audit trail)
      // Only track when in Setu mode to avoid polluting other modes
      const currentAgent = getCurrentAgent();
      if (currentAgent.toLowerCase() === 'setu') {
        recordToolExecution(activeBatches, input.sessionID, input.tool);
      }
      
      // Delegate to the main before hook for Phase 0 enforcement
      return beforeHook(input, output);
    },
    
    // Track verification steps and context (file reads, searches)
    // Only tracks when in Setu agent - silent in Build/Plan
    // Wrapped for graceful degradation (2.10)
    'tool.execute.after': wrapHook(
      'tool.execute.after',
      createToolExecuteAfterHook(
        markVerificationStep,
        getCurrentAgent,
        getContextCollector
      )
    ),
    
    // Handle session lifecycle events
    // Loads existing context on session start for continuity
    // Performs Silent Exploration: loads project rules automatically
    // Cleans up parallel execution tracking on session end
    // Wrapped for graceful degradation (2.10)
    event: wrapHook(
      'event',
      createEventHook(
        resetVerificationState,
        () => attemptTracker.clearAll(),
        setFirstSessionDone,
        confirmContext,
        resetPhase0,
        getContextCollector,
        refreshSetuFilesExist,  // Silent file existence check
        setProjectRules,         // Silent Exploration: store loaded rules
        getProjectDir,           // Project directory accessor (avoids process.cwd())
        activeBatches            // Parallel execution tracking cleanup
      )
    ),
    
    // Compaction safety: inject active task into compaction summary
    // Prevents "going rogue" after context compression
    // Wrapped for graceful degradation (2.10)
    'experimental.session.compacting': wrapHook(
      'session.compacting',
      createCompactionHook(getProjectDir, getCurrentAgent)
    ),
    
    // Custom tools
    tool: {
      setu_verify: createSetuVerifyTool(markVerificationComplete, getProjectDir),
      setu_context: createSetuContextTool(getPhase0State, confirmContext, getContextCollector, getProjectDir),
      setu_feedback: createSetuFeedbackTool(getProjectDir),
      setu_task: createSetuTaskTool(getProjectDir, resetVerificationState),
      setu_research: createSetuResearchTool(getProjectDir),
      setu_plan: createSetuPlanTool(getProjectDir),
      setu_reset: createSetuResetTool(getProjectDir),
      setu_doctor: createSetuDoctorTool(getProjectDir)
    }
  };
};

// Default export for OpenCode plugin loader
export default SetuPlugin;
