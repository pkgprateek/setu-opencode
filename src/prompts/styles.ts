/**
 * Style types and utilities for Setu operational styles (presets)
 * 
 * Terminology:
 * - "Mode" = OpenCode's IDE-level agents (Plan, Build, Setu)
 * - "Style" = Setu's operational presets (ultrathink, quick, collab)
 * 
 * Magic Command Patterns (in order of precedence):
 * 1. Prefix: `:quick`, `:ultrathink`, `:collab`
 * 2. Aliases: `:fast` → quick, `:trust` → collab
 */

import {
  COMMAND_PREFIX,
  VALID_STYLES,
  STYLE_ALIASES,
  KEY_VALUE_PREFIXES
} from '../constants';

export type SetuStyle = 'ultrathink' | 'quick' | 'collab';

export interface StyleState {
  current: SetuStyle;
  isPersistent: boolean;  // true if set via "style: x", false if temporary
}

/**
 * Check if a string is a valid SetuStyle
 */
function isValidStyle(value: string): value is SetuStyle {
  return (VALID_STYLES as readonly string[]).includes(value);
}

/**
 * Resolve a style name or alias to a canonical SetuStyle
 * 
 * @param name - Style name or alias (e.g., 'quick', 'fast', 'trust')
 * @returns The canonical SetuStyle, or null if not recognized
 */
function resolveStyle(name: string): SetuStyle | null {
  const lower = name.toLowerCase();
  
  // Direct match against valid styles
  if (isValidStyle(lower)) {
    return lower;
  }
  
  // Check aliases
  const aliased = STYLE_ALIASES[lower];
  if (aliased) {
    return aliased;
  }
  
  return null;
}

/**
 * Detect style from user prompt using magic command patterns.
 * 
 * Supports three patterns (checked in order):
 * 1. Prefix pattern: Message starts with `:stylename` (e.g., `:quick`, `:fast`)
 * 2. Key-value pattern: `style: quick`, `mode: collab`, `preset: collab`
 * 3. Aliases are resolved automatically (e.g., `:fast` → quick)
 * 
 * @param prompt - The user's message content
 * @returns { style, isPersistent: true } or null if no style detected
 */
export function detectStyle(prompt: string): { style: SetuStyle; isPersistent: boolean } | null {
  const trimmed = prompt.trim();
  const lowerPrompt = trimmed.toLowerCase();
  
  // Pattern 1: Prefix command (`:quick`, `:fast`, `:ultrathink`)
  // Must be at the start of the message
  if (lowerPrompt.startsWith(COMMAND_PREFIX)) {
    // Extract the word after the colon
    const match = lowerPrompt.match(/^:(\w+)/);
    if (match) {
      const styleName = match[1];
      const resolved = resolveStyle(styleName);
      if (resolved) {
        return { style: resolved, isPersistent: true };
      }
    }
  }
  
  // Pattern 2: Key-value pattern (`style: quick`, `mode: collab`, `preset: collab`)
  // Can appear anywhere in the message, but typically at the start
  for (const prefix of KEY_VALUE_PREFIXES) {
    // Match "prefix:" followed by optional whitespace and a word
    // Case-insensitive matching
    const regex = new RegExp(`${prefix}:\\s*(\\w+)`, 'i');
    const match = lowerPrompt.match(regex);
    if (match) {
      const styleName = match[1];
      const resolved = resolveStyle(styleName);
      if (resolved) {
        return { style: resolved, isPersistent: true };
      }
    }
  }
  
  return null;
}

/**
 * Check if the message is ONLY a style command (no other task content)
 */
export function isStyleOnlyCommand(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (!trimmed) return false;

  // Prefix-only: ":quick" or ":ultrathink"
  if (trimmed.startsWith(COMMAND_PREFIX)) {
    const match = trimmed.match(/^:(\w+)$/);
    if (!match) return false;
    return resolveStyle(match[1]) !== null;
  }

  // Key-value only: "style: quick" / "mode: collab" / "preset: quick"
  for (const prefix of KEY_VALUE_PREFIXES) {
    const regex = new RegExp(`^${prefix}:\\s*(\\w+)$`, 'i');
    const match = trimmed.match(regex);
    if (match && resolveStyle(match[1])) {
      return true;
    }
  }

  return false;
}

/**
 * Get verification requirements for a style
 */
export function getStyleVerificationLevel(style: SetuStyle): 'full' | 'minimal' | 'discuss' {
  switch (style) {
    case 'ultrathink':
      return 'full';      // Build, test, lint, visual, edge cases
    case 'quick':
      return 'minimal';   // Only if risky changes
    case 'collab':
      return 'discuss';   // Discuss what to verify, trust user decision
  }
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
    case 'collab':
      return 'light';     // Discuss before enforcing, trust user
  }
}
