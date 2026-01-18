/**
 * Mode types and utilities for Setu operating modes
 */

export type SetuMode = 'ultrathink' | 'quick' | 'expert' | 'collab';

export interface ModeState {
  current: SetuMode;
  isPersistent: boolean;  // true if set via "mode: x", false if temporary
}

/**
 * Keywords that trigger mode detection
 * 
 * Persistent triggers: "mode: quick", "mode: expert", etc.
 * Temporary triggers: "quick fix this", "just do it", etc.
 */
export const MODE_TRIGGERS = {
  ultrathink: {
    persistent: ['mode: ultrathink', 'mode: default', 'mode: full'],
    temporary: ['ultrathink', 'think deeply', 'full protocol']
  },
  quick: {
    persistent: ['mode: quick', 'mode: fast'],
    temporary: ['quick', 'fast', 'just fix', 'just do it', 'simple fix', 'quickly']
  },
  expert: {
    persistent: ['mode: expert', 'mode: trust'],
    temporary: ['expert', 'trust me', 'skip explanation', 'i know what i want']
  },
  collab: {
    persistent: ['mode: collab', 'mode: collaborate', 'mode: discuss'],
    temporary: ['collab', 'discuss', 'brainstorm', "let's think", 'what do you think']
  }
} as const;

/**
 * Detect mode from user prompt
 * 
 * @returns { mode, isPersistent } or null if no mode detected
 */
export function detectMode(prompt: string): { mode: SetuMode; isPersistent: boolean } | null {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [mode, triggers] of Object.entries(MODE_TRIGGERS)) {
    // Check persistent triggers first (higher priority)
    for (const trigger of triggers.persistent) {
      if (lowerPrompt.includes(trigger)) {
        return { mode: mode as SetuMode, isPersistent: true };
      }
    }
    
    // Check temporary triggers
    for (const trigger of triggers.temporary) {
      if (lowerPrompt.includes(trigger)) {
        return { mode: mode as SetuMode, isPersistent: false };
      }
    }
  }
  
  return null;
}

/**
 * Get verification requirements for a mode
 */
export function getModeVerificationLevel(mode: SetuMode): 'full' | 'minimal' | 'user-driven' | 'discuss' {
  switch (mode) {
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

/**
 * Get enforcement level for a mode
 */
export function getModeEnforcementLevel(mode: SetuMode): 'strict' | 'light' | 'none' {
  switch (mode) {
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
