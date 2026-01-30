/**
 * Style types and utilities for Setu operational styles (presets)
 * 
 * Terminology:
 * - "Mode" = OpenCode's IDE-level agents (Plan, Build, Setu)
 * - "Style" = Setu's operational presets (ultrathink, quick, expert, collab)
 * 
 * Magic Command Patterns:
 * - Prefix: :quick, :expert, :ultrathink, :collab
 * - Key-Value: style: quick, mode: quick, preset: quick
 * - Aliases: :fast → quick, :trust → expert, :think → ultrathink
 */

import {
  COMMAND_PREFIX,
  VALID_STYLES,
  STYLE_ALIASES,
  KEY_VALUE_PREFIXES,
} from '../constants';

export type SetuStyle = 'ultrathink' | 'quick' | 'expert' | 'collab';

// Backwards compatibility alias
export type SetuProfile = SetuStyle;

export interface StyleState {
  current: SetuStyle;
  isPersistent: boolean;  // true if set via "style: x", false if temporary
}

// Backwards compatibility alias
export type ProfileState = StyleState;

/**
 * Keywords that trigger style detection
 * 
 * Only persistent triggers allowed - user must explicitly request style change.
 * Supports both "style:" and legacy "mode:" prefixes.
 */
export const STYLE_TRIGGERS = {
  ultrathink: {
    persistent: ['style: ultrathink', 'style: default', 'style: full', 'mode: ultrathink', 'mode: default', 'mode: full'],
  },
  quick: {
    persistent: ['style: quick', 'style: fast', 'mode: quick', 'mode: fast'],
  },
  expert: {
    persistent: ['style: expert', 'style: trust', 'mode: expert', 'mode: trust'],
  },
  collab: {
    persistent: ['style: collab', 'style: collaborate', 'style: discuss', 'mode: collab', 'mode: collaborate', 'mode: discuss'],
  }
} as const;

// Backwards compatibility alias
export const PROFILE_TRIGGERS = STYLE_TRIGGERS;

/**
 * Resolve a style name or alias to a valid SetuStyle
 * 
 * @param name - Style name or alias (case-insensitive)
 * @returns The resolved style or null if invalid
 */
function resolveStyleName(name: string): SetuStyle | null {
  const lower = name.toLowerCase().trim();
  
  // Direct match
  if (VALID_STYLES.includes(lower as SetuStyle)) {
    return lower as SetuStyle;
  }
  
  // Alias lookup
  const aliased = STYLE_ALIASES[lower];
  if (aliased) {
    return aliased;
  }
  
  return null;
}

/**
 * Detect style from user prompt using magic commands
 * 
 * Supports three patterns (in order of precedence):
 * 1. Prefix commands: `:quick`, `:expert`, `:ultrathink`, `:collab`
 * 2. Key-value pairs: `style: quick`, `mode: quick`, `preset: quick`
 * 3. Legacy triggers: `mode: quick` (for backwards compatibility)
 * 
 * @returns { style, isPersistent: true } or null if no style detected
 */
export function detectStyle(prompt: string): { style: SetuStyle; isPersistent: boolean } | null {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  
  // Pattern 1: Prefix commands (e.g., `:quick` at start of message)
  // Must be at the very start of the message
  if (trimmed.startsWith(COMMAND_PREFIX)) {
    // Extract the command (up to first space or end of string)
    const commandEnd = trimmed.indexOf(' ', 1);
    const command = commandEnd > 0 
      ? trimmed.slice(1, commandEnd) 
      : trimmed.slice(1);
    
    const resolved = resolveStyleName(command);
    if (resolved) {
      return { style: resolved, isPersistent: true };
    }
  }
  
  // Pattern 2: Key-value pairs at start of message (e.g., `style: quick`)
  // Regex: ^(style|mode|preset):\s*(\w+)
  for (const prefix of KEY_VALUE_PREFIXES) {
    const regex = new RegExp(`^${prefix}:\\s*(\\w+)`, 'i');
    const match = lower.match(regex);
    if (match) {
      const resolved = resolveStyleName(match[1]);
      if (resolved) {
        return { style: resolved, isPersistent: true };
      }
    }
  }
  
  // Pattern 3: Legacy - check anywhere in the message (backwards compatibility)
  // This allows "mode: quick" anywhere, which is the old behavior
  for (const [style, triggers] of Object.entries(STYLE_TRIGGERS)) {
    for (const trigger of triggers.persistent) {
      if (lower.includes(trigger)) {
        return { style: style as SetuStyle, isPersistent: true };
      }
    }
  }
  
  return null;
}

// Backwards compatibility alias
export function detectProfile(prompt: string): { profile: SetuStyle; isPersistent: boolean } | null {
  const result = detectStyle(prompt);
  if (result) {
    return { profile: result.style, isPersistent: result.isPersistent };
  }
  return null;
}

/**
 * Get verification requirements for a style
 */
export function getStyleVerificationLevel(style: SetuStyle): 'full' | 'minimal' | 'user-driven' | 'discuss' {
  switch (style) {
    case 'ultrathink':
      return 'full';      // Build, test, lint, visual, edge cases
    case 'quick':
      return 'minimal';   // Only if risky changes
    case 'expert':
      return 'user-driven'; // Suggest but don't enforce
    case 'collab':
      return 'discuss';   // Discuss what to verify
  }
}

// Backwards compatibility alias
export function getProfileVerificationLevel(profile: SetuStyle): 'full' | 'minimal' | 'user-driven' | 'discuss' {
  return getStyleVerificationLevel(profile);
}

/**
 * Get enforcement level for a style
 */
export function getStyleEnforcementLevel(style: SetuStyle): 'strict' | 'light' | 'none' {
  switch (style) {
    case 'ultrathink':
      return 'strict';    // Enforce todo completion, verification
    case 'quick':
      return 'none';      // No enforcement
    case 'expert':
      return 'light';     // Suggest but don't block
    case 'collab':
      return 'light';     // Discuss before enforcing
  }
}

// Backwards compatibility alias
export function getProfileEnforcementLevel(profile: SetuStyle): 'strict' | 'light' | 'none' {
  return getStyleEnforcementLevel(profile);
}
