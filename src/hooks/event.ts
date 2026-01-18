/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 */

// Event hook for session lifecycle

/**
 * Creates the event hook for session lifecycle
 * 
 * Handles:
 * - session.created: Reset verification state, log session start
 * - session.deleted: Cleanup if needed
 */
export function createEventHook(
  resetVerificationState: () => void,
  resetAttemptTracker: () => void,
  setFirstSessionDone: () => void
) {
  return async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
    switch (event.type) {
      case 'session.created':
        console.log('[Setu] New session started');
        resetVerificationState();
        resetAttemptTracker();
        setFirstSessionDone();
        break;
        
      case 'session.deleted':
        console.log('[Setu] Session ended');
        break;
        
      case 'session.compacted':
        console.log('[Setu] Session compacted');
        break;
    }
  };
}
