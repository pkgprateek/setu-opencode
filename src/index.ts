/**
 * Setu - OpenCode Plugin
 * 
 * A master craftsman persona that transforms AI into a thoughtful, expert colleague.
 * 
 * Features:
 * - Operating modes: Ultrathink, Quick, Expert, Collab
 * - Enforcement: Phase 0 blocking, verification before completion
 * - Skills: Bootstrap, verification, rules creation, code quality, and more
 * 
 * @see https://github.com/pkgprateek/setu-opencode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { type ModeState } from './prompts/modes';
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
import { createSetuModeTool } from './tools/setu-mode';
import { createSetuVerifyTool } from './tools/setu-verify';
import { createSetuContextTool } from './tools/setu-context';
import { lspTools } from './tools/lsp-tools';

// Plugin state
interface SetuState {
  mode: ModeState;
  isFirstSession: boolean;
  verificationSteps: Set<VerificationStep>;
  verificationComplete: boolean;
  phase0: Phase0State;
}

/**
 * Setu Plugin for OpenCode
 * 
 * Uses available hooks from the OpenCode Plugin API:
 * - experimental.chat.system.transform: Inject persona into system prompt
 * - chat.message: Detect mode keywords in user messages
 * - tool.execute.before: Phase 0 enforcement (block side-effects until context confirmed)
 * - tool.execute.after: Track verification steps
 * - event: Handle session lifecycle
 * - tool: Custom tools (setu_mode, setu_verify, setu_context, lsp_*)
 */
export const SetuPlugin: Plugin = async (_ctx) => {
  // Initialize state
  const state: SetuState = {
    mode: {
      current: 'ultrathink',
      isPersistent: true
    },
    isFirstSession: true,
    verificationSteps: new Set(),
    verificationComplete: false,
    phase0: {
      contextConfirmed: false,
      sessionId: '',
      startedAt: Date.now()
    }
  };
  
  // Create attempt tracker for "2 tries then ask" pattern
  const attemptTracker = createAttemptTracker();
  
  // State accessors
  const getModeState = () => state.mode;
  const setModeState = (newState: ModeState) => { state.mode = newState; };
  
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
  console.log('[Setu] Default mode:', state.mode.current);
  console.log('[Setu] Phase 0 enforcement: ACTIVE');
  console.log('[Setu] Skills bundled: setu-bootstrap, setu-verification, setu-rules-creation, code-quality, refine-code, commit-helper, pr-review');
  
  return {
    // Inject Setu persona into system prompt
    'experimental.chat.system.transform': createSystemTransformHook(
      getModeState,
      getVerificationState
    ),
    
    // Detect mode keywords in user messages
    'chat.message': createChatMessageHook(
      getModeState,
      setModeState
    ),
    
    // Phase 0: Block side-effect tools until context is confirmed
    'tool.execute.before': createToolExecuteBeforeHook(getPhase0State),
    
    // Track verification steps from tool executions
    'tool.execute.after': createToolExecuteAfterHook(markVerificationStep),
    
    // Handle session lifecycle events
    event: createEventHook(
      resetVerificationState,
      () => attemptTracker.clearAll(),
      setFirstSessionDone,
      resetPhase0
    ),
    
    // Custom tools
    tool: {
      setu_mode: createSetuModeTool(getModeState, setModeState),
      setu_verify: createSetuVerifyTool(getModeState, markVerificationComplete),
      setu_context: createSetuContextTool(getPhase0State, confirmContext),
      ...lspTools
    }
  };
};

// Default export for OpenCode plugin loader
export default SetuPlugin;
