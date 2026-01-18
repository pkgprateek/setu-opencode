/**
 * Session idle hook - Enforces verification and todo completion before stopping
 */

import { getModeEnforcementLevel, getModeVerificationLevel, type SetuMode } from '../prompts/modes';

export interface SessionIdleInput {
  session: {
    id: string;
  };
  status: 'completed' | 'aborted' | 'error';
}

export interface SessionIdleOutput {
  followup_message?: string;
}

export interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Creates a session.idle hook handler
 * 
 * This hook enforces:
 * 1. Todo continuation - Don't stop with incomplete tasks
 * 2. Verification - Run checks before "done" (based on mode)
 */
export function createSessionIdleHook(
  getModeState: () => { current: SetuMode },
  getTodos: (sessionId: string) => Promise<Todo[]>,
  getVerificationRan: (sessionId: string) => boolean,
  setVerificationReminder: (sessionId: string) => void
) {
  return async (
    input: SessionIdleInput,
    output: SessionIdleOutput
  ): Promise<void> => {
    // Don't enforce on aborted or error states
    if (input.status !== 'completed') {
      return;
    }
    
    const mode = getModeState().current;
    const enforcement = getModeEnforcementLevel(mode);
    
    // No enforcement for quick mode
    if (enforcement === 'none') {
      return;
    }
    
    // Check for incomplete todos
    const todos = await getTodos(input.session.id);
    const incomplete = todos.filter(
      t => t.status === 'pending' || t.status === 'in_progress'
    );
    
    if (incomplete.length > 0) {
      const todoList = incomplete
        .slice(0, 3)  // Show max 3 todos
        .map(t => `- ${t.content}`)
        .join('\n');
      
      const moreCount = incomplete.length > 3 ? ` (and ${incomplete.length - 3} more)` : '';
      
      if (enforcement === 'strict') {
        output.followup_message = `You have ${incomplete.length} incomplete task(s)${moreCount}:

${todoList}

Please complete these before stopping, or mark them as cancelled if no longer needed.`;
        return;
      } else if (enforcement === 'light') {
        output.followup_message = `Note: ${incomplete.length} task(s) still pending. Continue or mark as cancelled?`;
        return;
      }
    }
    
    // Check verification (only for strict enforcement)
    if (enforcement === 'strict') {
      const verificationLevel = getModeVerificationLevel(mode);
      
      if (verificationLevel === 'full' && !getVerificationRan(input.session.id)) {
        setVerificationReminder(input.session.id);
        output.followup_message = `Before completing, please verify:
1. Build passes: \`npm run build\`
2. Tests pass: \`npm test\`
3. Lint clean: \`npm run lint\`

Or load the \`setu-verification\` skill for detailed protocol.`;
      }
    }
  };
}
