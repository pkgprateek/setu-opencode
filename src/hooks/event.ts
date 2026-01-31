/**
 * Event hook - Handle session lifecycle events
 * 
 * Uses: event
 * 
 * Resets state on new sessions, tracks session lifecycle.
 * Checks file existence silently to avoid errors on first run.
 * Loads existing context on session start for continuity.
 * Performs Silent Exploration: loads project rules automatically.
 */

import { type ContextCollector, detectProjectInfo, type ProjectRules, loadProjectRules } from '../context';
import { debugLog } from '../debug';
import { type ActiveBatchesMap, disposeSessionBatch } from './tool-execute';

/**
 * Create an event handler for session lifecycle events.
 *
 * @param resetVerificationState - Resets verification-related state when a new session starts
 * @param resetAttemptTracker - Resets attempt tracking when a new session starts
 * @param setFirstSessionDone - Marks that the first session has completed
 * @param confirmContext - Callback to mark context as confirmed
 * @param resetPhase0 - Optional callback to reset Phase 0 state for the given `sessionId`
 * @param getContextCollector - Optional accessor that returns a `ContextCollector` (or `null`) used to load or update session context from disk
 * @param checkFilesExist - Optional callback to silently check file existence without errors
 * @param setProjectRules - Optional callback to store loaded project rules (Silent Exploration)
 * @param getProjectDir - Optional callback to get the project directory (avoids process.cwd() fallback)
 * @param activeBatches - Optional active batches map for parallel execution tracking cleanup
 * @returns The event handler function that processes session events and updates internal state and context
 */
export function createEventHook(
  resetVerificationState: () => void,
  resetAttemptTracker: () => void,
  setFirstSessionDone: () => void,
  confirmContext: () => void,
  resetPhase0?: (sessionId: string) => void,
  getContextCollector?: () => ContextCollector | null,
  checkFilesExist?: () => { active: boolean; context: boolean; agentsMd: boolean; claudeMd: boolean },
  setProjectRules?: (rules: ProjectRules | null) => void,
  getProjectDir?: () => string,
  activeBatches?: ActiveBatchesMap
) {
  return async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }): Promise<void> => {
    switch (event.type) {
      case 'session.created': {
        // SESSION DELIMITER: Makes debug logs readable by clearly separating sessions
        const sessionId = (event.properties?.sessionID as string) || 'unknown';
        debugLog('\n\n========================================');
        debugLog(`=== NEW SESSION: ${sessionId} ===`);
        debugLog('========================================\n');
        
        resetVerificationState();
        resetAttemptTracker();
        setFirstSessionDone();
        
        if (resetPhase0) {
          resetPhase0(sessionId);
        }
        
        // Resolve project directory once for all operations in this session
        const resolvedProjectDir = getProjectDir ? getProjectDir() : process.cwd();
        
        // Check file existence silently (no errors on first run)
        const filesExist = checkFilesExist ? checkFilesExist() : null;
        
        // SILENT EXPLORATION: Load project rules automatically on session start
        // This injects AGENTS.md, CLAUDE.md, .setu/active.json content into system prompt
        // so Setu starts "informed" rather than asking questions docs already answer
        if (setProjectRules) {
          try {
            const rules = loadProjectRules(resolvedProjectDir);
            setProjectRules(rules);
            debugLog('Silent Exploration: Project rules loaded successfully');
          } catch (error) {
            debugLog('Silent Exploration: Failed to load project rules:', error);
            setProjectRules(null);
          }
        }
        
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
              if (ctx.filesRead.length > 0) {
                debugLog(`Files read: ${ctx.filesRead.length} files`);
              }
              // Mark as confirmed so Phase 0 doesn't block unnecessarily
              // User can still update context if needed
              confirmContext();
            }
          }
        } else if (!filesExist?.context) {
          debugLog('No existing context - fresh start');
          
          // Optional: Detect project info for new context (lightweight operation)
          if (getContextCollector) {
            const collector = getContextCollector();
            if (collector) {
              try {
                const projectInfo = detectProjectInfo(resolvedProjectDir);
                if (Object.keys(projectInfo).length > 0) {
                  collector.updateProjectInfo(projectInfo);
                  debugLog(`Detected project: ${projectInfo.type || 'unknown'}`);
                }
              } catch {
                // Non-fatal - project detection is optional
                debugLog('Could not detect project info');
              }
            }
          }
        }
        break;
      }
        
      case 'session.deleted': {
        const sessionId = (event.properties?.sessionID as string) || 'unknown';
        debugLog(`Session ended: ${sessionId}`);
        
        // Clean up parallel execution tracking to prevent timer leaks
        if (activeBatches) {
          disposeSessionBatch(activeBatches, sessionId);
        }
        break;
      }
        
      case 'session.compacted': {
        const sessionId = (event.properties?.sessionID as string) || 'unknown';
        debugLog(`Session compacted: ${sessionId}`);
        break;
      }
    }
  };
}