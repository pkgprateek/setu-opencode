/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 * Loads existing context from .setu/ on session start for continuity.
 */

import { type ContextCollector, detectProjectInfo } from '../context';

/**
 * Creates the event hook for session lifecycle
 * 
 * Handles:
 * - session.created: Reset verification state, Phase 0, load context
 * - session.deleted: Cleanup if needed
 * 
 * @param resetVerificationState - Callback to reset verification state
 * @param resetAttemptTracker - Callback to reset attempt tracker
 * @param setFirstSessionDone - Callback to mark first session complete
 * @param resetPhase0 - Callback to reset Phase 0 state
 * @param getContextCollector - Accessor for context collector (for loading)
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
