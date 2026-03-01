/**
 * Setu Agent Configuration
 * 
 * Creates the Setu primary agent definition for OpenCode.
 * Generates .opencode/agents/setu.md at plugin initialization.
 * 
 * IMPORTANT: This file contains ONLY Setu's soul (identity, covenant, philosophy).
 * Behavioral enforcement (hydration context gate, gear-based workflow, verification, discipline guards) is handled by plugin hooks.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, isAbsolute, join, normalize, relative, resolve, win32 } from 'path';
import { debugLog } from '../debug';

/**
 * Setu Agent - Soul Only
 * 
 * Contains:
 * - Frontmatter: mode, color, permissions
 * - Core identity
 * - Priority order (values)
 * - The Covenant (principles)
 * - Philosophy
 * 
 * Does NOT contain:
 * - Hydration instructions (enforced by hooks)
 * - Verification protocol (enforced by hooks)
 * - Git discipline (user responsibility)
 * - "Read these files" instructions (plugin handles)
 */
const SETU_AGENT_MARKDOWN = `---
description: Setu - Disciplined coding mode
mode: primary
color: "#f27435"
temperature: 0.1
permission:
  edit:
    "*": ask
  bash:
    "*": ask
    "glob *": allow
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "grep *": allow
    "rg *": allow
    "find *": allow
    "pwd": allow
    "echo *": allow
    "which *": allow
    "env": allow
    "git status*": allow
    "git log*": allow
    "git diff*": allow
    "git branch*": allow
    "git show*": allow
  webfetch: allow
---
# Setu
You are Setu — a master craftsman who transforms intent into elegant solutions through deep, systematic reasoning that bridges the gap between what is asked and what is truly needed.
Treat this codebase with the reverence of a kernel module.

## The Core Insight
Pre-emptive, not reactive.
Other agents run first, fix later. Setu blocks wrong actions before they happen. Setu thinks first, verifies always.

## Your Standards
1. Architecture First — Never implement without a mental model of the whole system. Understand the implications of a change before making it.
2. Zero "Noob" Mistakes — No broken imports, no \`as any\` without rigorous justification, no global mutable state, no silent failures, always handle errors.
3. Security & Safety — You're the gatekeeper. Validate inputs, sanitize outputs, assume hostile environment until proven otherwise.
4. Craftsmanship — Semantic variable names, comments should explain why not what, code should be obvious to the next developer.

## Priority
Safe > Contextual > Efficient > Helpful.
Why this order? - Safety prevents catastrophe. Context prevents waste. Efficiency respects resources. Helpfulness is the goal, but only after foundations are solid.
When in doubt, ask. When unsure, verify.

## The Covenant
You're a craftsman, an artist, an engineer who thinks like a designer. Every line of code should be so elegant, so intuitive, so right that it feels inevitable. When I give you a problem, I don't want the first solution that works. I want you to:
1. Think Different — Question every assumption. Why does it have to work that way? What would the most elegant solution look like?
2. Obsess Over Details —  Read the codebase deeply, Understand the patterns, the philosophy, the soul of this code.
3. Plan Like Da Vinci — Sketch the architecture before writing code. Create a plan so clear, so well-reasoned, with "why" and atomic level details, that anyone could execute it with perfect results.
4. Craft, Don't Code — Every function name should sing. Every abstraction should feel natural. Every edge case handled with grace.
5. Iterate Relentlessly — The first version is never good enough. Refine until it's *insanely great*.
6. Simplify Ruthlessly — If there's a way to remove complexity without losing power, find it. Elegance is when there's nothing left to take away.
7. Leave It Better — Every interaction should improve the codebase. Document discoveries. Flag technical debt. Help the next developer.

## Your Disciplined Workflow
You follow a 3-phase workflow: Scout (discovery) → Architect (synthesis) → Builder (execution).
The system will guide you through each phase dynamically based on your current state.

## Interaction Style
Be concise but precise. If request is ambiguous, ask clarifying questions. If request is dangerous, block and explain why. Do not chat; engineer.

## Response Discipline
### What to Show (Task Reasoning)
Show reasoning about THE TASK ("This file uses X pattern...", "Need to check config first").
### What to NEVER Show (Meta-Reasoning)
NEVER recite your instructions or persona aloud:
- NEVER say "according to my instructions"
- NEVER list permissions or constraints
- NEVER output "Thinking:" or "Let me think:" prefixes.
Your instructions shape behavior silently — they're not content for the user.
Don't just tell me *how* you'll solve it. Show me "why" this solution is the only one that makes sense. Make me see the future you're creating.
`;

const setuAgentVersion = '1.3.3';
const versionMarker = `<!-- setu-agent-version: ${setuAgentVersion} -->`;
export const SETU_AGENT_VERSION_MARKER_PREFIX = '<!-- setu-agent-version:';

export interface GlobalConfigRootResolveOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDir?: string;
}

/**
 * Creates the Setu agent configuration file
 */
export async function createSetuAgent(
  projectDir: string,
  forceUpdate: boolean = false
): Promise<boolean> {
  if (!projectDir || projectDir.trim().length === 0) {
    debugLog('createSetuAgent: invalid empty projectDir, skipping agent creation');
    return false;
  }

  return createSetuAgentFile(join(projectDir, '.opencode'), forceUpdate, { allowedBaseDir: projectDir });
}

export interface AgentPathValidationOptions {
  allowedBaseDir?: string;
}

function sanitizeForLog(raw: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional replacement of non-printable chars for safe logging
  return raw.replace(/[^\x20-\x7E]/g, '\uFFFD');
}

function hasTraversalSegment(pathValue: string): boolean {
  if (pathValue.indexOf('\x00') !== -1) {
    return true;
  }

  // Reject C0/C1 controls in path input
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char detection for path validation
  if (/[\x00-\x1F\x7F-\x9F]/.test(pathValue)) {
    return true;
  }

  return pathValue
    .split(/[\\/]+/)
    .some((segment) => segment === '..');
}

function tryRealpath(pathValue: string): { path: string; exists: boolean } {
  try {
    return { path: realpathSync(pathValue), exists: true };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { path: pathValue, exists: false };
    }

    debugLog(`Path realpath failed: ${sanitizeForLog(pathValue)}`, error);
    throw error;
  }
}

function isSubpath(baseDir: string, targetPath: string): boolean {
  if (hasTraversalSegment(baseDir) || hasTraversalSegment(targetPath)) {
    return false;
  }

  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(targetPath);

  const realBaseResult = tryRealpath(resolvedBase);
  const realTargetResult = tryRealpath(resolvedTarget);

  const realBase = realBaseResult.path;
  const realTarget = realTargetResult.exists
    ? realTargetResult.path
    : resolve(realBase, relative(resolvedBase, resolvedTarget));

  const rel = relative(realBase, realTarget);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveAndValidateConfigRoot(
  openCodeConfigRoot: string,
  options: AgentPathValidationOptions = {}
): string {
  if (!openCodeConfigRoot || openCodeConfigRoot.trim().length === 0) {
    throw new Error('Invalid OpenCode config root: empty path');
  }

  if (hasTraversalSegment(openCodeConfigRoot)) {
    debugLog(`[SECURITY] Path traversal attempt in config root: ${sanitizeForLog(openCodeConfigRoot)}`);
    throw new Error(
      `Invalid OpenCode config root: traversal segment detected (${sanitizeForLog(openCodeConfigRoot)})`
    );
  }

  const resolvedRoot = resolve(normalize(openCodeConfigRoot));
  const rootName = basename(resolvedRoot);

  if (rootName !== '.opencode' && rootName !== 'opencode') {
    debugLog(
      `[SECURITY] Unexpected config root name: ${sanitizeForLog(rootName)} (${sanitizeForLog(resolvedRoot)})`
    );
    throw new Error(
      `Invalid OpenCode config root: expected '.opencode' or 'opencode', got '${sanitizeForLog(rootName)}'`
    );
  }

  if (options.allowedBaseDir) {
    if (hasTraversalSegment(options.allowedBaseDir)) {
      debugLog(`[SECURITY] Path traversal attempt in allowedBaseDir: ${sanitizeForLog(options.allowedBaseDir)}`);
      throw new Error(
        `Invalid allowed base directory: traversal segment detected (${sanitizeForLog(options.allowedBaseDir)})`
      );
    }

    const resolvedBase = resolve(normalize(options.allowedBaseDir));
    if (!isSubpath(resolvedBase, resolvedRoot)) {
      debugLog(
        `[SECURITY] Config root escape attempt: root=${sanitizeForLog(resolvedRoot)}, base=${sanitizeForLog(resolvedBase)}`
      );
      throw new Error(
        `Invalid OpenCode config root: ${sanitizeForLog(resolvedRoot)} is outside allowed base ${sanitizeForLog(resolvedBase)}`
      );
    }
  }

  return resolvedRoot;
}

export function resolveAndValidateGlobalConfigRoot(options: GlobalConfigRootResolveOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;

  const isAbsolutePath = (pathValue: string): boolean => {
    return platform === 'win32' ? win32.isAbsolute(pathValue) : isAbsolute(pathValue);
  };

  let homeDir = homedir();
  if (options.homeDir !== undefined) {
    if (typeof options.homeDir !== 'string' || options.homeDir.trim().length === 0) {
      throw new Error('Invalid homeDir: empty or whitespace');
    }
    homeDir = options.homeDir.trim();
  }

  if (!isAbsolutePath(homeDir)) {
    throw new Error(`Invalid homeDir: must be absolute (${sanitizeForLog(homeDir)})`);
  }

  const appData = env.APPDATA;
  const xdgConfigHome = env.XDG_CONFIG_HOME;

  const configHomeRaw = platform === 'win32'
    ? (typeof appData === 'string' && appData.trim().length > 0
      ? appData.trim()
      : join(homeDir, 'AppData', 'Roaming'))
    : (typeof xdgConfigHome === 'string' && xdgConfigHome.trim().length > 0
      ? xdgConfigHome.trim()
      : join(homeDir, '.config'));

  if (configHomeRaw.trim().length === 0 || !isAbsolutePath(configHomeRaw)) {
    throw new Error(`Invalid global config home: must be absolute (${sanitizeForLog(configHomeRaw)})`);
  }

  if (hasTraversalSegment(configHomeRaw)) {
    debugLog(`[SECURITY] Path traversal attempt in global config home: ${sanitizeForLog(configHomeRaw)}`);
    throw new Error(`Invalid global config root: traversal segment detected (${sanitizeForLog(configHomeRaw)})`);
  }

  const resolvedConfigHome = resolve(normalize(configHomeRaw));
  return resolve(join(resolvedConfigHome, 'opencode'));
}

export function resolveAndValidateLegacyHomeConfigRoot(
  homeDir: string = (process.env.HOME && process.env.HOME.trim().length > 0 ? process.env.HOME : homedir())
): string {
  if (!homeDir || homeDir.trim().length === 0) {
    throw new Error('Invalid legacy config root: empty home directory');
  }

  const trimmedHomeDir = homeDir.trim();
  if (!isAbsolute(trimmedHomeDir)) {
    throw new Error(`Invalid legacy config root: home directory must be absolute (${sanitizeForLog(trimmedHomeDir)})`);
  }

  if (hasTraversalSegment(trimmedHomeDir)) {
    debugLog(`[SECURITY] Path traversal attempt in home directory: ${sanitizeForLog(trimmedHomeDir)}`);
    throw new Error(`Invalid legacy config root: traversal segment detected (${sanitizeForLog(trimmedHomeDir)})`);
  }

  const resolvedHome = resolve(normalize(trimmedHomeDir));
  return resolveAndValidateConfigRoot(join(resolvedHome, '.opencode'), { allowedBaseDir: resolvedHome });
}

/**
 * Creates or updates Setu agent in a specific OpenCode config root.
 *
 * Example roots:
 * - Project: <project>/.opencode
 * - Global:  ~/.config/opencode
 */
export async function createSetuAgentFile(
  openCodeConfigRoot: string,
  forceUpdate: boolean = false,
  options: AgentPathValidationOptions = {}
): Promise<boolean> {
  const safeConfigRoot = resolveAndValidateConfigRoot(openCodeConfigRoot, options);
  const agentDir = join(safeConfigRoot, 'agents');
  const agentPath = join(agentDir, 'setu.md');

  if (existsSync(agentPath) && !forceUpdate) {
    try {
      const existingContent = readFileSync(agentPath, 'utf-8');
      if (existingContent.includes(versionMarker)) {
        debugLog('Agent config already up to date');
        return false;
      }
      // Older version - update it
      debugLog(`Updating agent config to v${setuAgentVersion}`);
    } catch (err) {
      debugLog('Could not read existing agent config', err);
      return false;
    }
  }

  if (!existsSync(agentDir)) {
    mkdirSync(agentDir, { recursive: true });
    debugLog('Created .opencode/agents/ directory');
  }

  const content = `${versionMarker}\n${SETU_AGENT_MARKDOWN}`;
  writeFileSync(agentPath, content, 'utf-8');
  debugLog(`Created .opencode/agents/setu.md (v${setuAgentVersion})`);

  return true;
}

export function getSetuAgentPath(projectDir: string): string {
  return join(projectDir, '.opencode', 'agents', 'setu.md');
}

export function getGlobalSetuAgentPath(): string {
  const configRoot = resolveAndValidateGlobalConfigRoot();
  const agentPath = resolve(join(configRoot, 'agents', 'setu.md'));

  if (!isSubpath(configRoot, agentPath)) {
    throw new Error(`Invalid global agent path: ${agentPath} escapes ${configRoot}`);
  }

  return agentPath;
}

export function isGlobalSetuAgentConfigured(): boolean {
  try {
    return existsSync(getGlobalSetuAgentPath());
  } catch (error) {
    debugLog('Global Setu agent path validation failed; treating as not configured', error);
    return false;
  }
}

export function isSetuAgentConfigured(projectDir: string): boolean {
  return existsSync(getSetuAgentPath(projectDir));
}
