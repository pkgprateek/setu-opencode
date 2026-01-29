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
 * Get complete state injection for system prompt
 * 
 * This is minimal - just profile and file availability.
 * The agent file already contains the full persona.
 */
export const getStateInjection = (
  profile: SetuProfile,
  files: FileAvailability,
  isDefault: boolean = false
): string => {
  const profilePrefix = getModePrefix(profile, isDefault);
  const fileInfo = getFileAvailability(files);
  
  return `${profilePrefix}\n${fileInfo}`;
};

// Legacy exports for backwards compatibility
export const SETU_PERSONA = ''; // No longer used - persona is in agent file
export const MODE_DESCRIPTIONS = {}; // No longer used - profiles described in agent file

export const getInitialPrompt = (_profile: string): string => {
  // No longer injects full persona - that's in the agent file
  return '';
};
