/**
 * System transform hook - Injects dynamic state into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * IMPORTANT: This hook injects dynamic state AND loaded context.
 * The full persona is already in the agent file (.opencode/agents/setu.md).
 * 
 * When in Setu mode: Injects style + file availability + project rules + context content + read history
 * When in Build/Plan: Does nothing (Setu is off)
 */

import { getStateInjection, type FileAvailability } from '../prompts/persona';
import type { ProfileState } from '../prompts/profiles';
import { 
  type ContextCollector, 
  contextToSummary, 
  formatContextForInjection,
  type ProjectRules,
  formatRulesForInjection,
  hasProjectRules
} from '../context';

/**
 * Format files already read for injection into system prompt
 * 
 * This prevents the "Loop of Stupid" - re-reading files the agent already read.
 * Token-efficient: just paths, not content.
 * 
 * @param filesRead - Array of file paths that have been read
 * @returns Formatted injection string or empty string if no files
 */
function formatFilesAlreadyRead(filesRead: Array<{ path: string }>): string {
  if (filesRead.length === 0) return '';
  
  // Limit to last 50 files to avoid bloating system prompt
  const recentFiles = filesRead.slice(-50);
  const paths = recentFiles.map(f => f.path).join(', ');
  
  return `[FILES ALREADY READ]: ${paths}`;
}

/**
 * Creates the system transform hook
 * 
 * Injects:
 * - [Style: Ultrathink] (or current style)
 * - [Context: AGENTS.md, .setu/context.json]
 * - Silent Exploration: Project rules (AGENTS.md, CLAUDE.md, active task)
 * - Loaded context content (summary, constraints, patterns)
 * - [FILES ALREADY READ]: List of files already read (prevents re-reading)
 * 
 * Does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 * - Response format prefix (removed - visual noise)
 */
export function createSystemTransformHook(
  getProfileState: () => ProfileState,
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> },
  getSetuFilesExist?: () => FileAvailability,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null,
  getProjectRules?: () => ProjectRules | null
): (
  _input: { sessionID: string },
  output: { system: string[] }
) => Promise<void> {
  return async (
    _input: { sessionID: string },
    output: { system: string[] }
  ): Promise<void> => {
    // Only inject when in Setu agent mode
    const currentAgent = getCurrentAgent ? getCurrentAgent() : 'setu';
    if (currentAgent.toLowerCase() !== 'setu') {
      return;
    }
    
    const profileState = getProfileState();
    const isDefault = profileState.current === 'ultrathink';
    
    // Get file availability for context injection
    const filesExist: FileAvailability = getSetuFilesExist 
      ? getSetuFilesExist() 
      : { active: false, context: false, agentsMd: false, claudeMd: false };
    
    // Inject minimal state - style and file availability
    const stateInjection = getStateInjection(profileState.current, filesExist, isDefault);
    output.system.push(stateInjection);
    
    // SILENT EXPLORATION: Inject project rules (AGENTS.md, CLAUDE.md, active task)
    // This happens BEFORE context injection because rules are foundational
    if (getProjectRules) {
      const projectRules = getProjectRules();
      if (projectRules && hasProjectRules(projectRules)) {
        const rulesInjection = formatRulesForInjection(projectRules);
        output.system.push(rulesInjection);
      }
    }
    
    // CRITICAL: Inject loaded context content (summary, constraints, patterns)
    // This ensures constraints like "sandbox only" survive restarts
    if (getContextCollector) {
      const collector = getContextCollector();
      if (collector) {
        const context = collector.getContext();
        
        // Inject FILES ALREADY READ to prevent re-reading
        // This is always useful, even if context isn't confirmed yet
        if (context.filesRead.length > 0) {
          output.system.push(formatFilesAlreadyRead(context.filesRead));
        }
        
        // Only inject full context if confirmed and meaningful
        if (context.confirmed && (context.summary || context.patterns.length > 0 || context.currentTask)) {
          const summary = contextToSummary(context);
          const contextBlock = formatContextForInjection(summary);
          output.system.push(contextBlock);
          
          // NOTE: We no longer inject context.summary separately.
          // formatContextForInjection() already includes the task via summary.task.
          // The previous "[Previous Understanding]" block was redundant and wasted tokens.
        }
      }
    }
    
    // Add verification reminder for ultrathink profile when needed
    const verificationState = getVerificationState();
    if (profileState.current === 'ultrathink' && !verificationState.complete) {
      const stepsNeeded = ['build', 'test', 'lint'].filter(
        s => !verificationState.stepsRun.has(s)
      );
      
      if (stepsNeeded.length > 0) {
        output.system.push(`[Verify before done: ${stepsNeeded.join(', ')}]`);
      }
    }
    
    // NOTE: [RESPONSE FORMAT] block removed intentionally
    // The prefix [Profile: Ultrathink] is visual noise.
    // The user knows the mode via Toast/UI; the agent knows via system prompt injection above.
  };
}
