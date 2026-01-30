/**
 * Setu Dynamic State Injection
 * 
 * This module provides ONLY dynamic state for injection via hooks.
 * The full persona is in the agent file (.opencode/agents/setu.md).
 * 
 * What this injects:
 * - Current profile indicator
 * - File availability
 * - Smart guidance based on what exists
 * 
 * What this does NOT inject:
 * - Full persona (already in agent file)
 * - Behavioral instructions (enforced by hooks)
 * - Phase 0 ceremony (blocked by hooks)
 */

import type { SetuProfile } from './profiles';
import { READ_ONLY_TOOLS, SIDE_EFFECT_TOOLS } from '../constants';

// ============================================================================
// Parallel Execution Guidance
// ============================================================================

/**
 * Generates parallel execution guidance for system prompt injection.
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
  const sideEffectList = [...SIDE_EFFECT_TOOLS, 'bash'].join(', ');
  
  return `
[EFFICIENCY RULES]
These rules apply ONLY to read-only operations. Safety constraints always take precedence.

1. PARALLEL EXECUTION IS MANDATORY for independent read-only operations.
   - Applies to: ${readOnlyList}
   - Does NOT apply to: ${sideEffectList}, or any side-effect tool
   - BAD: read(A) -> wait -> read(B) -> wait -> glob(C)
   - GOOD: read(A) & read(B) & glob(C) in ONE message

2. Batch your context gathering. Do not "explore" one file at a time.

3. Use 'glob' to find files, then 'read' relevant ones in parallel.

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
 * Profile display names
 */
const PROFILE_DISPLAY: Record<SetuProfile, string> = {
  ultrathink: 'Ultrathink',
  quick: 'Quick',
  expert: 'Expert',
  collab: 'Collab'
};

/**
 * Get profile prefix for responses
 */
export const getModePrefix = (profile: SetuProfile, isDefault: boolean = false): string => {
  const name = PROFILE_DISPLAY[profile];
  const suffix = isDefault ? ' (Default)' : '';
  return `[Profile: ${name}${suffix}]`;
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
  const profilePrefix = getModePrefix(profile, isDefault);
  const fileInfo = getFileAvailability(files);
  
  // Efficiency rules are always injected — they're behavioral, not persona
  return `${profilePrefix}\n${fileInfo}\n${PARALLEL_GUIDANCE}`;
};

// Legacy exports for backwards compatibility
export const SETU_PERSONA = ''; // No longer used - persona is in agent file
export const MODE_DESCRIPTIONS = {}; // No longer used - profiles described in agent file

export const getInitialPrompt = (_profile: string): string => {
  // No longer injects full persona - that's in the agent file
  return '';
};
