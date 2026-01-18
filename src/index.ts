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
 * @see https://github.com/prateekkumargoel/setu-opencode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { type SetuMode, type ModeState } from './prompts/modes';
import { createSessionStartHook } from './hooks/session-start';
import { createPromptAppendHook } from './hooks/prompt-append';
import { createSessionIdleHook, type Todo } from './hooks/session-idle';
import { createToolExecuteAfterHook, createAttemptTracker } from './hooks/tool-execute';
import { createSetuModeTool } from './tools/setu-mode';
import { createSetuVerifyTool } from './tools/setu-verify';
import { lspTools } from './tools/lsp-tools';

// Plugin state
interface SetuState {
  mode: ModeState;
  isFirstSession: boolean;
  verificationSteps: Set<'build' | 'test' | 'lint'>;
  verificationComplete: boolean;
  sessionVerificationReminders: Set<string>;
}

/**
 * Setu Plugin for OpenCode
 */
export const SetuPlugin: Plugin = async (ctx) => {
  const { client } = ctx;
  
  // Initialize state
  const state: SetuState = {
    mode: {
      current: 'ultrathink',
      isPersistent: true
    },
    isFirstSession: true,
    verificationSteps: new Set(),
    verificationComplete: false,
    sessionVerificationReminders: new Set()
  };
  
  // Attempt tracker for the 2-tries-then-ask pattern
  const attemptTracker = createAttemptTracker();
  
  // State accessors
  const getModeState = () => state.mode;
  const setModeState = (newState: ModeState) => { state.mode = newState; };
  const isFirstSession = () => state.isFirstSession;
  const setFirstSessionDone = () => { state.isFirstSession = false; };
  const getDefaultMode = (): SetuMode => 'ultrathink';
  
  // Verification tracking
  const markVerificationStep = (step: 'build' | 'test' | 'lint') => {
    state.verificationSteps.add(step);
    // Consider verified if build and test have run
    if (state.verificationSteps.has('build') && state.verificationSteps.has('test')) {
      state.verificationComplete = true;
    }
  };
  
  const getVerificationRan = (sessionId: string): boolean => {
    return state.verificationComplete || state.sessionVerificationReminders.has(sessionId);
  };
  
  const setVerificationReminder = (sessionId: string) => {
    state.sessionVerificationReminders.add(sessionId);
  };
  
  const markVerificationComplete = () => {
    state.verificationComplete = true;
  };
  
  // Todo fetching (uses OpenCode's todo system)
  const getTodos = async (sessionId: string): Promise<Todo[]> => {
    try {
      // OpenCode stores todos in session state
      // This is a placeholder - actual implementation depends on OpenCode's API
      const response = await client.todo.list({ sessionId });
      return response?.todos || [];
    } catch {
      return [];
    }
  };
  
  // Log plugin initialization
  await client.app.log({
    service: 'setu',
    level: 'info',
    message: 'Setu plugin initialized',
    extra: { mode: state.mode.current }
  });
  
  return {
    // Session created - inject persona
    'session.created': createSessionStartHook(
      getModeState,
      isFirstSession,
      setFirstSessionDone
    ),
    
    // Prompt append - detect mode keywords
    'tui.prompt.append': createPromptAppendHook(
      getModeState,
      setModeState,
      getDefaultMode
    ),
    
    // Session idle - enforce verification and todo completion
    'session.idle': createSessionIdleHook(
      getModeState,
      getTodos,
      getVerificationRan,
      setVerificationReminder
    ),
    
    // Tool execute after - track verification steps
    'tool.execute.after': createToolExecuteAfterHook(markVerificationStep),
    
    // Custom tools
    tool: {
      setu_mode: createSetuModeTool(getModeState, setModeState),
      setu_verify: createSetuVerifyTool(getModeState, markVerificationComplete),
      // LSP tools for IDE-like capabilities
      ...lspTools
    },
    
    // Event handler for general events
    event: async ({ event }) => {
      // Reset verification state on new session
      if (event.type === 'session.created') {
        state.verificationSteps.clear();
        state.verificationComplete = false;
      }
    }
  };
};

// Default export for OpenCode plugin loader
export default SetuPlugin;
