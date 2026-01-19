/**
 * setu_context tool - Confirm context for Phase 0
 * 
 * This tool allows the agent to mark that context has been confirmed,
 * which unlocks side-effect tools (write, edit, bash commands).
 */

import { tool } from '@opencode-ai/plugin';
import { type Phase0State } from '../enforcement';

export interface SetuContextResult {
  success: boolean;
  message: string;
  phase0Active: boolean;
}

/**
 * Creates the setu_context tool definition
 */
export function createSetuContextTool(
  getPhase0State: () => Phase0State,
  confirmContext: () => void
) {
  return tool({
    description: `Confirm that context has been gathered and understood. 
This unlocks side-effect tools (write, edit, bash commands) that are blocked during Phase 0.

Call this tool after:
1. Reading relevant files
2. Understanding the codebase structure
3. Getting any clarifications from the user

Once confirmed, you can proceed with modifications.`,
    
    args: {
      confirmation: tool.schema.string().describe(
        'A brief summary of what context was gathered and what the plan is'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const state = getPhase0State();
      
      if (state.contextConfirmed) {
        return `Context was already confirmed. Side-effect tools are already unlocked.`;
      }
      
      confirmContext();
      
      const duration = Math.round((Date.now() - state.startedAt) / 1000);
      
      return `**Phase 0 Complete** (${duration}s)

Context confirmed: ${args.confirmation}

Side-effect tools (write, edit, bash commands) are now unlocked.
Proceed with implementation.`;
    }
  });
}
