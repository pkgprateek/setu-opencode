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
    await createSetuAgent(projectDir);
  } catch (error) {
    console.error('[Setu] Failed to create agent config:', error);
  }
  
  // Initialize feedback file for transparency
  try {
    initializeFeedbackFile(projectDir);
  } catch (error) {
    // Non-critical - log but don't fail
    console.log('[Setu] Could not initialize feedback file:', error);
  }
  
  // Create context collector for .setu/ persistence
  let contextCollector: ContextCollector | null = null;
  try {
    contextCollector = createContextCollector(projectDir);
    // Try to load existing context
    contextCollector.loadFromDisk();
    console.log('[Setu] Context collector initialized');
  } catch (error) {
    console.log('[Setu] Could not initialize context collector:', error);
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
    }
  };
  
  // Create attempt tracker for "2 tries then ask" pattern
  const attemptTracker = createAttemptTracker();
  
  // State accessors
  const getProfileState = () => state.profile;
  const setProfileState = (newState: ProfileState) => { state.profile = newState; };
  
  // File existence checker (silent, no errors)
  const checkSetuFilesExist = () => {
    const fs = require('fs');
    const path = require('path');
    
    state.setuFilesExist = {
      active: fs.existsSync(path.join(projectDir, '.setu', 'active.json')),
      context: fs.existsSync(path.join(projectDir, '.setu', 'context.json')),
      agentsMd: fs.existsSync(path.join(projectDir, 'AGENTS.md')),
      claudeMd: fs.existsSync(path.join(projectDir, 'CLAUDE.md'))
    };
    
    return state.setuFilesExist;
  };
  
  const getCurrentAgent = () => state.currentAgent;
  const setCurrentAgent = (agent: string) => {
    if (agent !== state.currentAgent) {
      console.log(`[Setu] Agent changed: ${state.currentAgent} → ${agent}`);
      state.currentAgent = agent;
    }
  };
  
  const getPhase0State = () => state.phase0;
  const confirmContext = () => {
    state.phase0.contextConfirmed = true;
    console.log('[Setu] Phase 0: Context confirmed - side-effect tools now allowed');
  };
  const resetPhase0 = (sessionId: string) => {
    state.phase0 = {
      contextConfirmed: false,
      sessionId,
      startedAt: Date.now()
    };
    console.log('[Setu] Phase 0: Reset for new session');
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
  
  // Log plugin initialization
  console.log('[Setu] Plugin initialized');
  console.log('[Setu] Default profile:', state.profile.current);
  console.log('[Setu] Phase 0 enforcement: ACTIVE');
  console.log('[Setu] Context persistence: .setu/ directory');
  console.log('[Setu] Tools: setu_verify, setu_context, setu_feedback, lsp_*');
  console.log('[Setu] Skills bundled: setu-bootstrap, setu-verification, setu-rules-creation, code-quality, refine-code, commit-helper, pr-review');
  
  return {
    // Set Setu as the default agent
    // This hook receives the config and can modify it
    config: async (input: { default_agent?: string; [key: string]: unknown }) => {
      // Only set if not already configured by user
      if (!input.default_agent) {
        input.default_agent = 'setu';
        console.log('[Setu] Set as default agent');
      } else {
        console.log(`[Setu] User configured default_agent: ${input.default_agent}`);
      }
    },
    
    // Inject Setu persona into system prompt
    'experimental.chat.system.transform': createSystemTransformHook(
      getProfileState,
      getVerificationState
    ),
    
    // Detect profile keywords in user messages and track current agent
    'chat.message': createChatMessageHook(
      getProfileState,
      setProfileState,
      setCurrentAgent
    ),
    
    // Phase 0: Block side-effect tools until context is confirmed
    // Mode-aware: Full enforcement in Setu, light in Build, defer in Plan
    // Context injection: Injects context into subagent prompts
    'tool.execute.before': createToolExecuteBeforeHook(
      getPhase0State, 
      getCurrentAgent,
      getContextCollector
    ),
    
    // Track verification steps and context (file reads, searches)
    'tool.execute.after': createToolExecuteAfterHook(
      markVerificationStep,
      getContextCollector
    ),
    
    // Handle session lifecycle events
    // Loads existing context on session start for continuity
    event: createEventHook(
      resetVerificationState,
      () => attemptTracker.clearAll(),
      setFirstSessionDone,
      resetPhase0,
      getContextCollector,
      checkSetuFilesExist  // Silent file existence check
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
