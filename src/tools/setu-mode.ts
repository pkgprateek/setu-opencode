/**
 * setu_mode tool - Switch operating modes
 */

import { tool } from '@opencode-ai/plugin';
import { type SetuMode } from '../prompts/modes';
import { MODE_DESCRIPTIONS, getModePrefix } from '../prompts/persona';

export interface SetuModeResult {
  success: boolean;
  previousMode: SetuMode;
  newMode: SetuMode;
  message: string;
}

/**
 * Creates the setu_mode tool definition
 */
export function createSetuModeTool(
  getModeState: () => { current: SetuMode },
  setModeState: (state: { current: SetuMode; isPersistent: boolean }) => void
) {
  return tool({
    description: `Switch Setu's operating mode. Available modes:
- ultrathink: Full protocol (plan, implement, verify). For complex tasks.
- quick: Skip ceremony, minimal verification. For typos and small fixes.
- expert: Trust user judgment, propose but don't block. For experienced users.
- collab: Discuss options before implementing. For architecture decisions.`,
    
    args: {
      mode: tool.schema.string().describe(
        'The mode to switch to: ultrathink, quick, expert, or collab'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const normalizedMode = args.mode.toLowerCase() as SetuMode;
      
      // Validate mode
      const validModes: SetuMode[] = ['ultrathink', 'quick', 'expert', 'collab'];
      if (!validModes.includes(normalizedMode)) {
        return `Invalid mode: ${args.mode}. Valid modes: ${validModes.join(', ')}`;
      }
      
      const previousMode = getModeState().current;
      setModeState({ current: normalizedMode, isPersistent: true });
      
      const modeDesc = MODE_DESCRIPTIONS[normalizedMode];
      
      return `${getModePrefix(normalizedMode)}

Switched from ${previousMode} to ${normalizedMode}.

${modeDesc}

Mode will persist until changed.`;
    }
  });
}
