/**
 * setu_context tool - Confirm context for hydration
 * 
 * This tool allows the agent to mark that context has been confirmed,
 * which unlocks side-effect tools (write, edit, bash commands).
 * 
 * Enhanced to persist context to .setu/ directory for:
 * - Session continuity (survives restarts)
 * - Subagent injection (context shared with child agents)
 * - Audit trail (what was understood)
 * 
 * Security:
 * - All user inputs are sanitized to prevent prompt injection
 * - See src/security/prompt-sanitization.ts for details
 */

import { tool } from '@opencode-ai/plugin';
import { type HydrationState } from '../enforcement';
import { clearQuestionBlocked, type ContextCollector } from '../context';
import { errorLog } from '../debug';
import { sanitizeContextInput } from '../security/prompt-sanitization';
import { logSecurityEvent, SecurityEventType } from '../security/audit-log';

export interface SetuContextResult {
  success: boolean;
  message: string;
  hydrationActive: boolean;
}

/**
 * Create a tool that confirms hydration context, unlocks side-effect tools, and optionally persists the confirmed context.
 *
 * When executed the tool marks context as confirmed, may persist the provided summary/task/plan via a ContextCollector,
 * and returns a formatted status message including how long hydration took.
 *
 * @param getHydrationState - Accessor that returns the current hydration state
 * @param confirmContext - Callback used to mark hydration context as confirmed
 * @param getContextCollector - Optional accessor that returns a ContextCollector or `null`; if provided and non-null,
 *                              the collector is used to persist the confirmed context to disk
 * @param getProjectDir - Optional accessor for project directory (defaults to process.cwd())
 * @returns A tool definition that performs the context confirmation, optional persistence, and produces a status string
 */
export function createSetuContextTool(
  getHydrationState: () => HydrationState,
  confirmContext: () => void,
  getContextCollector?: () => ContextCollector | null,
  getProjectDir?: () => string
): ReturnType<typeof tool> {
  return tool({
    description: `Confirm that context has been gathered and understood. 
This unlocks side-effect tools (write, edit, bash commands) that are blocked during hydration.

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
    
    async execute(args, context): Promise<string> {
      const state = getHydrationState();
      const projectDir = getProjectDir ? getProjectDir() : process.cwd();
      
      if (state.contextConfirmed) {
        return `Context was already confirmed. Side-effect tools are already unlocked.

If you need to update the context or plan, you can continue working.`;
      }
      
      // SECURITY: Sanitize all user inputs to prevent prompt injection
      const sanitizedSummary = sanitizeContextInput(args.summary, 'summary');
      const sanitizedTask = sanitizeContextInput(args.task, 'task');
      const sanitizedPlan = args.plan ? sanitizeContextInput(args.plan, 'plan') : undefined;
      
      // Log if sanitization changed the input (possible injection attempt)
      if (sanitizedSummary !== args.summary || sanitizedTask !== args.task || 
          (args.plan && sanitizedPlan !== args.plan)) {
        logSecurityEvent(
          projectDir,
          SecurityEventType.PROMPT_INJECTION_SANITIZED,
          'Context input was sanitized - possible injection attempt',
          { sessionId: context?.sessionID, tool: 'setu_context' }
        );
      }
      
      // Confirm context in hydration state
      confirmContext();

      // setu_context is the fallback decision-resolution checkpoint when native
      // question tooling is unavailable in a runtime.
      if (context?.sessionID) {
        clearQuestionBlocked(context.sessionID);
      }
      
      // Persist to .setu/ if collector is available
      if (getContextCollector) {
        const collector = getContextCollector();
        if (collector) {
          try {
            // Use sanitized values for persistence
            collector.confirm(sanitizedSummary, sanitizedTask, sanitizedPlan);
            collector.saveToDisk();
          } catch (error) {
            errorLog('Failed to persist context:', error);
            // Non-fatal - continue even if persistence fails
          }
        }
      }
      
      const duration = Math.round((Date.now() - state.startedAt) / 1000);
      
      const planSection = sanitizedPlan 
        ? `\n\n**Plan:**\n${sanitizedPlan}` 
        : '';
      
      return `**Hydration Complete** (${duration}s)

**Understanding:**
${sanitizedSummary}

**Task:**
${sanitizedTask}${planSection}

---

Context confirmed and persisted to \`.setu/\`.
Side-effect tools (write, edit, bash commands) are now unlocked.
Proceed with implementation.`;
    }
  });
}
