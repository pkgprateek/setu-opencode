import type { SetuProfile } from './profiles';
import { STYLE_DISPLAY } from '../constants';

// ============================================================================
// File Availability
// ============================================================================

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
  
  // Only inject dynamic state - efficiency is enforced by hooks, not suggested
  return `${profilePrefix}\n${fileInfo}`;
};

// Legacy exports removed - no consumers exist
