/**
 * Setu - OpenCode Plugin
 * 
 * A master craftsman persona that transforms AI into a thoughtful, expert colleague.
 * 
 * Features:
 * - Operating profiles: Ultrathink, Quick, Expert, Collab
 * - Enforcement: Phase 0 blocking, verification before completion
 * - Context persistence: .setu/ directory for session continuity
 * - Skills: Bootstrap, verification, rules creation, code quality, and more
 * 
 * @see https://github.com/pkgprateek/setu-opencode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { existsSync } from 'fs';
import { join } from 'path';
import { type ProfileState } from './prompts/profiles';
import {
  createSystemTransformHook,
  createChatMessageHook,
  createToolExecuteBeforeHook,
  createToolExecuteAfterHook,
  createAttemptTracker,
  createEventHook,
  type VerificationStep
} from './hooks';
import { type Phase0State } from './enforcement';
import { createSetuVerifyTool } from './tools/setu-verify';
import { createSetuContextTool } from './tools/setu-context';
import { createSetuFeedbackTool } from './tools/setu-feedback';
import { lspTools } from './tools/lsp-tools';
import { createSetuAgent } from './agent/setu-agent';
import { 
  initializeFeedbackFile, 
  createContextCollector,
  type ContextCollector 
} from './context';
import { debugLog, alwaysLog, errorLog } from './debug';
import { type FileAvailability } from './prompts/persona';

// Plugin state
interface SetuState {
  profile: ProfileState;
  currentAgent: string;
  isFirstSession: boolean;
  verificationSteps: Set<VerificationStep>;
  verificationComplete: boolean;
  phase0: Phase0State;
  contextCollector: ContextCollector | null;
  
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
 * - chat.message: Detect profile keywords in user messages, track current agent
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
    profile: {
      current: 'ultrathink',
      isPersistent: true
    },
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
  
  // Create attempt tracker for "2 tries then ask" pattern
  const attemptTracker = createAttemptTracker();
  
  // State accessors
  const getProfileState = () => state.profile;
  const setProfileState = (newState: ProfileState) => { state.profile = newState; };
  const getSetuProfile = () => state.profile.current;
  
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
  debugLog('Default profile:', state.profile.current);
  debugLog('Phase 0 enforcement: ACTIVE');
  debugLog('Context persistence: .setu/ directory');
  debugLog('Tools: setu_verify, setu_context, setu_feedback, lsp_*');
  debugLog('Skills bundled: setu-bootstrap, setu-verification, setu-rules-creation, code-quality, refine-code, commit-helper, pr-review');
  
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
    'experimental.chat.system.transform': createSystemTransformHook(
      getProfileState,
      getVerificationState,
      () => state.setuFilesExist, // Pass file existence for lazy loading
      getCurrentAgent,
      getContextCollector // Pass context collector for content injection
    ),
    
    // Detect profile keywords in user messages and track current agent
    'chat.message': createChatMessageHook(
      getProfileState,
      setProfileState,
      setCurrentAgent
    ),
    
    // Phase 0: Block side-effect tools until context is confirmed
    // Consolidated enforcement (agent + profile level)
    // Priority: OpenCode Agent > Setu Profile
    'tool.execute.before': createToolExecuteBeforeHook(
      getPhase0State, 
      getCurrentAgent,
      getContextCollector,
      getSetuProfile
    ),
    
    // Track verification steps and context (file reads, searches)
    // Only tracks when in Setu agent - silent in Build/Plan
    'tool.execute.after': createToolExecuteAfterHook(
      markVerificationStep,
      getCurrentAgent,
      getContextCollector
    ),
    
    // Handle session lifecycle events
    // Loads existing context on session start for continuity
    event: createEventHook(
      resetVerificationState,
      () => attemptTracker.clearAll(),
      setFirstSessionDone,
      confirmContext,
      resetPhase0,
      getContextCollector,
      refreshSetuFilesExist  // Silent file existence check
    ),
    
    // Custom tools
    tool: {
      setu_verify: createSetuVerifyTool(getProfileState, markVerificationComplete),
      setu_context: createSetuContextTool(getPhase0State, confirmContext, getContextCollector),
      setu_feedback: createSetuFeedbackTool(getProjectDir),
      ...lspTools
    }
  };
};

// Default export for OpenCode plugin loader
export default SetuPlugin;
