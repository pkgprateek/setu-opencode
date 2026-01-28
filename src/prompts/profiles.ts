/**
 * Profile types and utilities for Setu operating profiles
 */

export type SetuProfile = 'ultrathink' | 'quick' | 'expert' | 'collab';

export interface ProfileState {
  current: SetuProfile;
  isPersistent: boolean;  // true if set via "mode: x", false if temporary
}

/**
 * Keywords that trigger profile detection
 * 
 * Only persistent triggers allowed - user must explicitly request profile change.
 * Removed temporary triggers to prevent accidental profile switching.
 */
export const PROFILE_TRIGGERS = {
  ultrathink: {
    persistent: ['mode: ultrathink', 'mode: default', 'mode: full'],
  },
  quick: {
    persistent: ['mode: quick', 'mode: fast'],
  },
  expert: {
    persistent: ['mode: expert', 'mode: trust'],
  },
  collab: {
    persistent: ['mode: collab', 'mode: collaborate', 'mode: discuss'],
  }
} as const;

/**
 * Detect profile from user prompt
 * 
 * Only checks for persistent triggers (explicit profile declarations).
 * @returns { profile, isPersistent: true } or null if no profile detected
 */
export function detectProfile(prompt: string): { profile: SetuProfile; isPersistent: boolean } | null {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [profile, triggers] of Object.entries(PROFILE_TRIGGERS)) {
    // Check persistent triggers only
    for (const trigger of triggers.persistent) {
      if (lowerPrompt.includes(trigger)) {
        return { profile: profile as SetuProfile, isPersistent: true };
      }
    }
  }
  
  return null;
}

/**
 * Get verification requirements for a profile
 */
export function getProfileVerificationLevel(profile: SetuProfile): 'full' | 'minimal' | 'user-driven' | 'discuss' {
  switch (profile) {
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
 * Get enforcement level for a profile
 */
export function getProfileEnforcementLevel(profile: SetuProfile): 'strict' | 'light' | 'none' {
  switch (profile) {
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
