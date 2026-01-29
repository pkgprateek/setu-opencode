/**
 * Style types and utilities for Setu operational styles (presets)
 * 
 * Terminology:
 * - "Mode" = OpenCode's IDE-level agents (Plan, Build, Setu)
 * - "Style" = Setu's operational presets (ultrathink, quick, expert, collab)
 */

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
 * Detect style from user prompt
 * 
 * Only checks for persistent triggers (explicit style declarations).
 * @returns { style, isPersistent: true } or null if no style detected
 */
export function detectStyle(prompt: string): { style: SetuStyle; isPersistent: boolean } | null {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [style, triggers] of Object.entries(STYLE_TRIGGERS)) {
    // Check persistent triggers only
    for (const trigger of triggers.persistent) {
      if (lowerPrompt.includes(trigger)) {
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
