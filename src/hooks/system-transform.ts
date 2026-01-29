/**
 * System transform hook - Injects dynamic state into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * IMPORTANT: This hook injects dynamic state AND loaded context.
 * The full persona is already in the agent file (.opencode/agents/setu.md).
 * 
 * When in Setu mode: Injects profile + file availability + context content
 * When in Build/Plan: Does nothing (Setu is off)
 */

import { getStateInjection, type FileAvailability, getModePrefix } from '../prompts/persona';
import type { ProfileState } from '../prompts/profiles';
import { type ContextCollector, contextToSummary, formatContextForInjection } from '../context';

/**
 * Creates the system transform hook
 * 
 * Injects:
 * - [Mode: Ultrathink] (or current profile)
 * - [Context: AGENTS.md, .setu/context.json]
 * - Loaded context content (summary, constraints, patterns)
 * - Response format requirements
 * 
 * Does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 */
export function createSystemTransformHook(
  getProfileState: () => ProfileState,
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> },
  getSetuFilesExist?: () => FileAvailability,
  getCurrentAgent?: () => string,
  getContextCollector?: () => ContextCollector | null
) {
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
    
    // Inject minimal state - profile and file availability
    const stateInjection = getStateInjection(profileState.current, filesExist, isDefault);
    output.system.push(stateInjection);
    
    // CRITICAL: Inject loaded context content (summary, constraints, patterns)
    // This ensures constraints like "sandbox only" survive restarts
    if (getContextCollector) {
      const collector = getContextCollector();
      if (collector) {
        const context = collector.getContext();
        // Only inject if context has meaningful content
        if (context.confirmed && (context.summary || context.patterns.length > 0 || context.currentTask)) {
          const summary = contextToSummary(context);
          const contextBlock = formatContextForInjection(summary);
          output.system.push(contextBlock);
          
          // Also inject explicit constraints/rules if present in summary
          if (context.summary) {
            output.system.push(`[Previous Understanding]\n${context.summary}`);
          }
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
    
    // RESPONSE FORMAT: Enforce mode prefix at start of every response
    output.system.push(`[RESPONSE FORMAT]
You MUST start every response with exactly: ${getModePrefix(profileState.current)}
This is non-negotiable. The mode prefix must be the first thing in your response.`);
  };
}
