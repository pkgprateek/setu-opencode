/**
 * Setu Dynamic State Injection
 * 
 * This module provides ONLY dynamic state for injection via hooks.
 * The full persona is in the agent file (.opencode/agents/setu.md).
 * 
 * What this injects:
 * - Current style indicator [Style: X]
 * - File availability
 * - Smart guidance based on what exists
 * 
 * What this does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 * - Phase 0 ceremony (blocked by hooks)
 */

import type { SetuProfile } from './profiles';
import { READ_ONLY_TOOLS, BLOCKED_TOOLS, STYLE_DISPLAY } from '../constants';

// ============================================================================
// Parallel Execution Guidance
// ============================================================================

/**
 * Generates efficiency guidance for system prompt injection.
 * 
 * Why this is a function, not a constant:
 * - Derives tool list from constants.ts (single source of truth)
 * - Ensures prompt guidance cannot drift from enforcement logic
 * - If we add a new read-only tool, the guidance updates automatically
 * 
 * Security notes:
 * - Explicitly scoped to read-only operations only
 * - References Priority Order (Safe > Efficient) to prevent override
 * - Lists both allowed AND disallowed tools for clarity
 */
function generateParallelGuidance(): string {
  const readOnlyList = READ_ONLY_TOOLS.join(', ');
  const blockedList = BLOCKED_TOOLS.join(', ');
  
  return `
[SETU: EFFICIENCY RULES]
These rules enforce the *Efficient* value in Priority Order. Safety constraints always take precedence.

1. **Use glob or list, not bash ls** — For file discovery, use native tools.
   - \`glob("**/*.ts")\` → find files by pattern
   - \`list("/src")\` → get directory tree structure
   - NEVER use \`bash("ls -R")\` or \`bash("find . -name '*.ts'")\`
   - Native tools are faster and don't spawn shell processes

2. **PARALLEL EXECUTION IS MANDATORY** for independent read-only operations.
   - Applies to: ${readOnlyList}
   - Does NOT apply to: ${blockedList}, or any side-effect tool
   - BAD: read(A) -> wait -> read(B) -> wait -> glob(C)
   - GOOD: read(A) & read(B) & glob(C) in ONE message

3. **Search smart** — Use \`grep\` for content search, \`glob\` for file patterns.
   - Don't iterate manually through directories
   - Batch your context gathering

4. **Minimize tokens** — Get context efficiently.
   - Don't explore the entire codebase when you only need specific files
   - Use glob to find, then read relevant ones in parallel

Remember: Safe > Efficient. When in doubt, ask.
`;
}

/**
 * Parallel execution guidance for system prompt injection.
 * 
 * Generated at module load time from constants to ensure
 * the tool list is always in sync with enforcement logic.
 */
export const PARALLEL_GUIDANCE = generateParallelGuidance();

/**
 * File existence state
 */
export interface FileAvailability {
  active: boolean;
  context: boolean;
  agentsMd: boolean;
  claudeMd: boolean;
}

/**
 * Get style prefix for responses
 * 
 * Format: [Style: Ultrathink] or [Style: Quick]
 * This aligns with the agent file instruction to acknowledge with [Style: X]
 */
export const getStylePrefix = (style: SetuProfile, isDefault: boolean = false): string => {
  const name = STYLE_DISPLAY[style];
  const suffix = isDefault ? ' (Default)' : '';
  return `[Style: ${name}${suffix}]`;
};

/**
 * Get file availability message
 * 
 * This tells the agent what context files exist WITHOUT instructing it to read them.
 * The agent can choose to read them if relevant to the task.
 */
export const getFileAvailability = (files: FileAvailability): string => {
  const available: string[] = [];
  
  // Priority order: project rules first
  if (files.agentsMd) available.push('AGENTS.md');
  if (files.claudeMd) available.push('CLAUDE.md');
  if (files.context) available.push('.setu/context.json');
  if (files.active) available.push('.setu/active.json');
  
  if (available.length === 0) {
    return '[Context: Fresh start - no project rules or previous context]';
  }
  
  const hasRules = files.agentsMd || files.claudeMd;
  const hasContext = files.context || files.active;
  
  let guidance = '';
  if (hasRules && hasContext) {
    guidance = 'Project rules and previous context available.';
  } else if (hasRules) {
    guidance = 'Project rules available.';
  } else if (hasContext) {
    guidance = 'Previous context available.';
  }
  
  return `[Context: ${available.join(', ')}]\n[${guidance}]`;
};

/**
 * Get complete state injection for system prompt.
 * 
 * Injects:
 * - Profile prefix (mode indicator)
 * - File availability (context awareness)
 * - Parallel execution guidance (efficiency enforcement)
 * 
 * This is intentionally minimal — the full persona lives in the agent file.
 * We only inject dynamic state that changes per-session.
 */
export const getStateInjection = (
  profile: SetuProfile,
  files: FileAvailability,
  isDefault: boolean = false
): string => {
  const profilePrefix = getStylePrefix(profile, isDefault);
  const fileInfo = getFileAvailability(files);
  
  // Efficiency rules are always injected — they're behavioral, not persona
  return `${profilePrefix}\n${fileInfo}\n${PARALLEL_GUIDANCE}`;
};

// Legacy exports removed - no consumers exist
