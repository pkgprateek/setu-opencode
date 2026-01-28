/**
 * System transform hook - Injects Setu persona into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * This is the primary mechanism for injecting Setu's identity and operating mode
 * into every conversation.
 */

import { getInitialPrompt, getModePrefix } from '../prompts/persona';
import type { ProfileState } from '../prompts/profiles';

/**
 * Creates the system transform hook
 * 
 * Injects:
 * - Mode prefix: [Mode: Ultrathink (Default)]
 * - Full Setu persona (~500 tokens)
 * - File existence summary (lazy loading - no context loaded at startup)
 * - Enforcement reminders based on verification state
 */
export function createSystemTransformHook(
  getProfileState: () => ProfileState,
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> },
  getSetuFilesExist?: () => { active: boolean; context: boolean; agentsMd: boolean; claudeMd: boolean }
) {
  return async (
    _input: { sessionID: string },
    output: { system: string[] }
  ): Promise<void> => {
    const modeState = getProfileState();
    const verificationState = getVerificationState();
    
    const persona = getInitialPrompt(modeState.current);
    const modePrefix = getModePrefix(modeState.current, modeState.current === 'ultrathink');
    
    // FIX 4: Lazy loading - inject file availability summary only (no full context)
    let fileAvailability = '';
    if (getSetuFilesExist) {
      const filesExist = getSetuFilesExist();
      const available: string[] = [];
      if (filesExist.context) available.push('.setu/context.json');
      if (filesExist.active) available.push('.setu/active.json');
      if (filesExist.agentsMd) available.push('AGENTS.md');
      if (filesExist.claudeMd) available.push('CLAUDE.md');
      
      if (available.length > 0) {
        fileAvailability = `\n[SETU:] **Context Available:** ${available.join(', ')}\n[SETU:] Read these files if you need context, but DON'T read them all at once - only read what's needed for the task.\n`;
      } else {
        fileAvailability = '\n[SETU:] **Context Available:** None (fresh start)\n';
      }
    }
    
    // Build the system prompt injection
    const systemInjection = `
${modePrefix}

${persona}
${fileAvailability}`;
    
    output.system.push(systemInjection);
    
    // Add verification reminder if in ultrathink mode and not yet verified
    if (modeState.current === 'ultrathink' && !verificationState.complete) {
      const stepsNeeded = ['build', 'test', 'lint'].filter(
        s => !verificationState.stepsRun.has(s)
      );
      
      if (stepsNeeded.length > 0) {
        output.system.push(`
## Verification Reminder

Before completing this task, ensure you run: ${stepsNeeded.join(', ')}.
Load the setu-verification skill for the full protocol.
`);
      }
    }
  };
}

