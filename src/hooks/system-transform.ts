/**
 * System transform hook - Injects Setu persona into system prompt
 * 
 * Uses: experimental.chat.system.transform
 * 
 * This is the primary mechanism for injecting Setu's identity and operating mode
 * into every conversation.
 */

import { getInitialPrompt, getModePrefix } from '../prompts/persona';
import type { ModeState } from '../prompts/modes';

/**
 * Creates the system transform hook
 * 
 * Injects:
 * - Mode prefix: [Mode: Ultrathink (Default)]
 * - Full Setu persona (~500 tokens)
 * - Enforcement reminders based on verification state
 */
export function createSystemTransformHook(
  getModeState: () => ModeState,
  getVerificationState: () => { complete: boolean; stepsRun: Set<string> }
) {
  return async (
    _input: { sessionID: string },
    output: { system: string[] }
  ): Promise<void> => {
    const modeState = getModeState();
    const verificationState = getVerificationState();
    
    const persona = getInitialPrompt(modeState.current);
    const modePrefix = getModePrefix(modeState.current, modeState.current === 'ultrathink');
    
    // Build the system prompt injection
    const systemInjection = `
${modePrefix}

${persona}
`;
    
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
