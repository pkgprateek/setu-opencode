/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 * Checks file existence silently to avoid errors on first run.
 * Loads existing context on session start for continuity.
 */

import { type ContextCollector, detectProjectInfo } from '../context';
import { debugLog } from '../debug';

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
        debugLog('New session started');
        resetVerificationState();
        resetAttemptTracker();
        setFirstSessionDone();
        
        if (resetPhase0) {
          const sessionId = (event.properties?.sessionID as string) || '';
          resetPhase0(sessionId);
        }
        
        // Check file existence silently (no errors on first run)
        const filesExist = checkFilesExist ? checkFilesExist() : null;
        
        // Load existing context on session start for continuity
        // This ensures constraints (like "sandbox only") survive restarts
        if (filesExist?.context && getContextCollector) {
          const collector = getContextCollector();
          if (collector) {
            const loaded = collector.loadFromDisk();
            if (loaded) {
              const ctx = collector.getContext();
              debugLog('Loaded context from previous session');
              if (ctx.summary) {
                debugLog(`Context summary: ${ctx.summary.slice(0, 100)}...`);
              }
              if (ctx.currentTask) {
                debugLog(`Previous task: ${ctx.currentTask.slice(0, 50)}...`);
              }
              // Mark as confirmed so Phase 0 doesn't block unnecessarily
              // User can still update context if needed
            }
          }
        } else if (!filesExist?.context) {
          debugLog('No existing context - fresh start');
          
          // Optional: Detect project info for new context (lightweight operation)
          if (getContextCollector) {
            const collector = getContextCollector();
            if (collector) {
              try {
                const projectDir = (event.properties?.projectDir as string) || process.cwd();
                const projectInfo = detectProjectInfo(projectDir);
                if (Object.keys(projectInfo).length > 0) {
                  collector.updateProjectInfo(projectInfo);
                  debugLog(`Detected project: ${projectInfo.type || 'unknown'}`);
                }
              } catch (error) {
                // Non-fatal - project detection is optional
                debugLog('Could not detect project info');
              }
            }
          }
        }
        break;
      }
        
      case 'session.deleted':
        debugLog('Session ended');
        break;
        
      case 'session.compacted':
        debugLog('Session compacted');
        break;
    }
  };
}