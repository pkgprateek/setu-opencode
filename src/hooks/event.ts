/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 * Checks file existence silently to avoid errors on first run.
 * Loads existing context only if files exist and user confirms.
 */

import { type ContextCollector, detectProjectInfo } from '../context';

/**
 * Create an event handler for session lifecycle events.
 *
 * @param resetVerificationState - Resets verification-related state when a new session starts
 * @param resetAttemptTracker - Resets attempt tracking when a new session starts
 * @param setFirstSessionDone - Marks that the first session has completed
 * @param resetPhase0 - Optional callback to reset Phase 0 state for the given `sessionId`
 * @param getContextCollector - Optional accessor that returns a `ContextCollector` (or `null`) used to load or update session context from disk
 * @param checkFilesExist - Optional callback to silently check file existence without errors
 * @returns The event handler function that processes session events and updates internal state and context
 */
export function createEventHook(
  resetVerificationState: () => void,
  resetAttemptTracker: () => void,
  setFirstSessionDone: () => void,
  resetPhase0?: (sessionId: string) => void,
  getContextCollector?: () => ContextCollector | null,
  checkFilesExist?: () => { active: boolean; context: boolean; agentsMd: boolean; claudeMd: boolean }
) {
  return async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }): Promise<void> => {
    switch (event.type) {
      case 'session.created': {
        console.log('[Setu] New session started');
        resetVerificationState();
        resetAttemptTracker();
        setFirstSessionDone();
        
        if (resetPhase0) {
          const sessionId = (event.properties?.sessionID as string) || '';
          resetPhase0(sessionId);
        }
        
        // Check file existence silently (no errors on first run)
        const filesExist = checkFilesExist ? checkFilesExist() : null;
        
        // FIX 4: Lazy loading - DON'T load context at startup
        // Context will be loaded on-demand when:
        // 1. User explicitly asks: "load previous context"
        // 2. Agent calls setu_context tool (reads then updates)
        // 3. Subagent is spawned (context injected into prompt)
        
        // Just log what's available, don't load
        if (filesExist?.context) {
          console.log('[Setu] Context file detected (.setu/context.json) - available for lazy load');
        } else {
          console.log('[Setu] No existing context - fresh start');
          
          // Optional: Detect project info for new context (lightweight operation)
          if (getContextCollector) {
            const collector = getContextCollector();
            if (collector) {
              try {
                const projectDir = (event.properties?.projectDir as string) || process.cwd();
                const projectInfo = detectProjectInfo(projectDir);
                if (Object.keys(projectInfo).length > 0) {
                  collector.updateProjectInfo(projectInfo);
                  console.log(`[Setu] Detected project: ${projectInfo.type || 'unknown'}`);
                }
              } catch (error) {
                // Non-fatal - project detection is optional
                console.log('[Setu] Could not detect project info');
              }
            }
          }
        }
        break;
      }
        
      case 'session.deleted':
        console.log('[Setu] Session ended');
        break;
        
      case 'session.compacted':
        console.log('[Setu] Session compacted');
        break;
    }
  };
}