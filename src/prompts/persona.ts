import type { SetuStyle } from './styles';
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
export const getStylePrefix = (style: SetuStyle, isDefault: boolean = false): string => {
  const name = STYLE_DISPLAY[style];
  const suffix = isDefault ? ' (Default)' : '';
  return `[Style: ${name}${suffix}]`;
};

/**
 * Style-specific context indicators (descriptive only, not behavioral).
 * 
 * JUSTIFICATION: These are descriptive labels for context, not enforcement.
 * Behavioral enforcement (blocking, verification gates) is handled by hooks.
 * These strings simply inform the agent of the operational context.
 */
const getStyleGuidance = (style: SetuStyle): string => {
  switch (style) {
    case 'quick':
      return 'Quick mode: minimal ceremony, fast iteration.';
    case 'collab':
      return 'Collab mode: discussion-first, pair-programming style.';
    case 'ultrathink':
      return 'Ultrathink mode: full discipline, thorough verification.';
  }
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
 * - [SETU:] prefix (traceable marker for all Setu injections)
 * - Style prefix (mode indicator)
 * - File availability (context awareness)
 * - Style guidance (descriptive only)
 * 
 * This is intentionally minimal — the full persona lives in the agent file.
 * We only inject dynamic state that changes per-session.
 * 
 * NOTE: No behavioral instructions here. Enforcement is via hooks.
 * Output format validation should be done via a separate response hook if needed.
 */
export const getStateInjection = (
  style: SetuStyle,
  files: FileAvailability,
  isDefault: boolean = false
): string => {
  const stylePrefix = getStylePrefix(style, isDefault);
  const fileInfo = getFileAvailability(files);
  const guidance = getStyleGuidance(style);
  
  // [SETU:] prefix makes all Setu injections traceable for debugging
  // Only dynamic state - no static behavioral instructions
  return `[SETU:] ${stylePrefix}\n${fileInfo}\n${guidance}`;
};

// Legacy exports removed - no consumers exist
