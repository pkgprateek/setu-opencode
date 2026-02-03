/**
 * Compaction Hook (Compaction Safety)
 * 
 * Uses: experimental.session.compacting
 * 
 * When OpenCode compacts a session (due to context overflow):
 * - Injects active task into compaction summary
 * - Injects key constraints (READ_ONLY, NO_PUSH, etc.)
 * - Ensures agent remembers what it was doing
 * 
 * This prevents "going rogue" after compaction where agent
 * forgets constraints and starts executing unrelated actions.
 */

import { loadActiveTask } from '../context/active';
import { loadContext } from '../context/storage';
import { debugLog } from '../debug';

/**
 * Compaction hook input (from OpenCode Plugin API)
 */
export interface CompactionInput {
  sessionID: string;
}

/**
 * Compaction hook output (from OpenCode Plugin API)
 * 
 * - context: Array of strings appended to default compaction prompt
 * - prompt: If set, replaces the entire compaction prompt
 */
export interface CompactionOutput {
  context: string[];
  prompt?: string;
}

/**
 * Creates the session compaction hook.
 * 
 * Injects critical information into compaction summary:
 * 1. Active task (CRITICAL - prevents rogue behavior)
 * 2. Key constraints (READ_ONLY, NO_PUSH, etc.)
 * 3. Project context summary (if available)
 * 
 * @param getProjectDir - Accessor for project directory
 * @returns Hook function for experimental.session.compacting
 */
export function createCompactionHook(
  getProjectDir: () => string,
  getCurrentAgent?: () => string
): (input: CompactionInput, output: CompactionOutput) => Promise<void> {
  
  return async (
    _input: CompactionInput,
    output: CompactionOutput
  ): Promise<void> => {
    // Defensively handle null/undefined currentAgent
    let currentAgent = getCurrentAgent ? getCurrentAgent() : undefined;
    if (!currentAgent) {
      currentAgent = 'setu';
    }
    
    if (currentAgent.toLowerCase() !== 'setu') {
      debugLog(`Compaction: Skipping - not in Setu mode (current agent: ${currentAgent})`);
      return;
    }

    const projectDir = getProjectDir();
    
    // Load active task
    const activeTask = loadActiveTask(projectDir);
    
    if (activeTask && activeTask.status === 'in_progress') {
      // Build constraints string with defensive check
      const constraintsStr = Array.isArray(activeTask.constraints) && activeTask.constraints.length > 0
        ? activeTask.constraints.join(', ')
        : 'none';
      
      // Build references string if present
      const referencesStr = Array.isArray(activeTask.references) && activeTask.references.length > 0
        ? `\nReferences: ${activeTask.references.join(', ')}`
        : '';
      
      // Inject active task as CRITICAL context
      output.context.push(`## Active Task (CRITICAL)

Task: ${activeTask.task}
Mode: ${activeTask.mode}
Constraints: ${constraintsStr}${referencesStr}
Started: ${activeTask.startedAt}

IMPORTANT: Resume this task. Do NOT start unrelated work.
${constraintsStr !== 'none' ? `\nCONSTRAINT ENFORCEMENT: The following constraints are ACTIVE and must be obeyed:
${activeTask.constraints.map(c => `- ${c}`).join('\n')}` : ''}`);
      
      debugLog('Compaction: Injected active task into summary');
    }
    
    // Load context summary if available
    const context = loadContext(projectDir);
    
    if (context?.summary) {
      // Defensively check filesRead is an array before using it
      const filesRead = Array.isArray(context.filesRead) ? context.filesRead : [];
      const filesWorkedOn = filesRead.length > 0
        ? `Key files worked on: ${filesRead.slice(0, 5).map(f => f.path).join(', ')}${filesRead.length > 5 ? ` (+${filesRead.length - 5} more)` : ''}`
        : '';
      
      output.context.push(`## Project Understanding

${context.summary}${filesWorkedOn ? `\n\n${filesWorkedOn}` : ''}`);
      
      debugLog('Compaction: Injected context summary');
    }
    
    // Add patterns if any were observed
    if (context?.patterns && context.patterns.length > 0) {
      const patternsSummary = context.patterns
        .slice(0, 5)
        .map(p => `- ${p.name}: ${p.description}`)
        .join('\n');
      
      output.context.push(`## Observed Patterns

${patternsSummary}`);
      
      debugLog('Compaction: Injected observed patterns');
    }
  };
}
