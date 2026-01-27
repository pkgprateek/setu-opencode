/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 * Loads existing context from .setu/ on session start for continuity.
 * 
 * TODO (v1.0 - Phase 0 Silent Reconnaissance):
 * - Read AGENTS.md and CLAUDE.md on session start
 * - Inject their content into the session context
 * - Check .setu/active.json for in-progress tasks
 * - This ensures Setu "knows" project rules before speaking
 * - See ROADMAP.md "Phase 0 Silent Reconnaissance" for details
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
 * @returns The event handler function that processes session events and updates internal state and context
 */
export function createEventHook(
  resetVerificationState: () => void,
  resetAttemptTracker: () => void,
  setFirstSessionDone: () => void,
  resetPhase0?: (sessionId: string) => void,
  getContextCollector?: () => ContextCollector | null
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
        
        // Load existing context for session continuity
        if (getContextCollector) {
          const collector = getContextCollector();
          if (collector) {
            const loaded = collector.loadFromDisk();
            if (loaded) {
              const context = collector.getContext();
              console.log(`[Setu] Loaded existing context (confirmed: ${context.confirmed})`);
              
              // If context was already confirmed, we might want to keep Phase 0 unlocked
              // But for now, we reset Phase 0 to require re-confirmation each session
              // This is safer - user might be working on something different
            } else {
              // No existing context - detect project info for new context
              try {
                // Get project dir from properties or use cwd
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