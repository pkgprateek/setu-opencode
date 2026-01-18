/**
 * Setu - OpenCode Plugin
 * 
 * A master craftsman persona that transforms AI into a thoughtful, expert colleague.
 * 
 * Features:
 * - Operating modes: Ultrathink, Quick, Expert, Collab
 * - Enforcement: Todo continuation, verification before completion
 * - Skills: Bootstrap, verification, rules creation, code quality, and more
 * 
 * @see https://github.com/pkgprateek/setu-opencode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { type ModeState } from './prompts/modes';
import {
  createSystemTransformHook,
  createChatMessageHook,
  createToolExecuteAfterHook,
  createAttemptTracker,
  createEventHook,
  type VerificationStep
} from './hooks';
import { createSetuModeTool } from './tools/setu-mode';
import { createSetuVerifyTool } from './tools/setu-verify';
import { lspTools } from './tools/lsp-tools';

// Plugin state
interface SetuState {
  mode: ModeState;
  isFirstSession: boolean;
  verificationSteps: Set<VerificationStep>;
  verificationComplete: boolean;
}

/**
 * Setu Plugin for OpenCode
 * 
 * Uses available hooks from the OpenCode Plugin API:
 * - experimental.chat.system.transform: Inject persona into system prompt
 * - chat.message: Detect mode keywords in user messages
 * - tool.execute.after: Track verification steps
 * - event: Handle session lifecycle
 * - tool: Custom tools (setu_mode, setu_verify, lsp_*)
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
    verificationComplete: false
  };
  
  // Create attempt tracker for "2 tries then ask" pattern
  const attemptTracker = createAttemptTracker();
  
  // State accessors
  const getModeState = () => state.mode;
  const setModeState = (newState: ModeState) => { state.mode = newState; };
  
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
    
    // Track verification steps from tool executions
    'tool.execute.after': createToolExecuteAfterHook(markVerificationStep),
    
    // Handle session lifecycle events
    event: createEventHook(
      resetVerificationState,
      () => attemptTracker.clearAll(),
      setFirstSessionDone
    ),
    
    // Custom tools
    tool: {
      setu_mode: createSetuModeTool(getModeState, setModeState),
      setu_verify: createSetuVerifyTool(getModeState, markVerificationComplete),
      ...lspTools
    }
  };
};

// Default export for OpenCode plugin loader
export default SetuPlugin;
