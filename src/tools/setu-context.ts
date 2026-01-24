/**
 * setu_context tool - Confirm context for Phase 0
 * 
 * This tool allows the agent to mark that context has been confirmed,
 * which unlocks side-effect tools (write, edit, bash commands).
 * 
 * Enhanced to persist context to .setu/ directory for:
 * - Session continuity (survives restarts)
 * - Subagent injection (context shared with child agents)
 * - Audit trail (what was understood)
 */

import { tool } from '@opencode-ai/plugin';
import { type Phase0State } from '../enforcement';
import { type ContextCollector } from '../context';

export interface SetuContextResult {
  success: boolean;
  message: string;
  phase0Active: boolean;
}

/**
 * Creates the setu_context tool definition
 * 
 * @param getPhase0State - Accessor for Phase 0 state
 * @param confirmContext - Callback to mark context as confirmed
 * @param getContextCollector - Optional accessor for context collector (for persistence)
 */
export function createSetuContextTool(
  getPhase0State: () => Phase0State,
  confirmContext: () => void,
  getContextCollector?: () => ContextCollector | null
) {
  return tool({
    description: `Confirm that context has been gathered and understood. 
This unlocks side-effect tools (write, edit, bash commands) that are blocked during Phase 0.

Call this tool after:
1. Reading relevant files (entry points, configs, key modules)
2. Understanding the codebase structure and patterns
3. Getting any clarifications from the user

Provide:
- A summary of what you learned about the project
- What the current task/goal is
- Your plan for accomplishing it

Once confirmed, context is persisted to .setu/ for continuity.`,
    
    args: {
      summary: tool.schema.string().describe(
        'Summary of what you learned about the project (structure, patterns, key files)'
      ),
      task: tool.schema.string().describe(
        'The current task/goal you are working on'
      ),
      plan: tool.schema.string().optional().describe(
        'Your plan for accomplishing the task (optional but recommended)'
      )
    },
    
    async execute(args, _context): Promise<string> {
      const state = getPhase0State();
      
      if (state.contextConfirmed) {
        return `Context was already confirmed. Side-effect tools are already unlocked.

If you need to update the context or plan, you can continue working.`;
      }
      
      // Confirm context in Phase 0 state
      confirmContext();
      
      // Persist to .setu/ if collector is available
      if (getContextCollector) {
        const collector = getContextCollector();
        if (collector) {
          try {
            collector.confirm(args.summary, args.task, args.plan);
            collector.saveToDisk();
          } catch (error) {
            console.error('[Setu] Failed to persist context:', error);
            // Non-fatal - continue even if persistence fails
          }
        }
      }
      
      const duration = Math.round((Date.now() - state.startedAt) / 1000);
      
      const planSection = args.plan 
        ? `\n\n**Plan:**\n${args.plan}` 
        : '';
      
      return `**Phase 0 Complete** (${duration}s)

**Understanding:**
${args.summary}

**Task:**
${args.task}${planSection}

---

Context confirmed and persisted to \`.setu/\`.
Side-effect tools (write, edit, bash commands) are now unlocked.
Proceed with implementation.`;
    }
  });
}
