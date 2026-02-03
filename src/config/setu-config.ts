/**
 * Setu Configuration System
 * 
 * Allows users to customize Setu behavior without code changes.
 * 
 * Priority order (higher wins):
 * 1. Project config: .setu/setu.json
 * 2. Global config: ~/.config/opencode/setu.json
 * 3. Defaults
 * 
 * @see PLAN.md Section 2.8
 * @see assets/setu.schema.json for JSON schema
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve, relative, isAbsolute } from 'path';
import { homedir } from 'os';
import { debugLog } from '../debug';

/**
 * Setu configuration interface
 */
export interface SetuConfig {
  /** JSON Schema reference (for IDE support) */
  $schema?: string;
  
  /** Maximum retry attempts before suggesting gear shift (default: 3) */
  maxAttempts: number;
  
  /** Output verbosity level (default: 'standard') */
  verbosity: 'minimal' | 'standard' | 'verbose';
  
  /** Maximum context.json size in bytes (default: 51200 = 50KB) */
  contextSizeLimit: number;
  
  /** Maximum injection size in characters (default: 8000 ~2000 tokens) */
  injectionSizeLimit: number;
  
  /** Feature flags */
  features: {
    /** Enable colored output in logs (default: true) */
    coloredOutput: boolean;
    
    /** Enable gold tests for critical paths (default: false) */
    goldTests: boolean;
    
    /** Enable pre-commit checklist enforcement (default: true) */
    preCommitChecklist: boolean;
    
    /** Enable environment doctor auto-check on session start (default: false) */
    autoDoctorCheck: boolean;
  };
  
  /** Security settings */
  security: {
    /** Maximum verification log size before rotation (bytes, default: 1MB) */
    maxLogSize: number;
    
    /** Number of rotated log files to keep (default: 3) */
    maxLogFiles: number;
    
    /** Block unknown tools in Phase 0 (fail-closed, default: true) */
    failClosedForUnknownTools: boolean;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: SetuConfig = {
  maxAttempts: 3,
  verbosity: 'standard',
  contextSizeLimit: 51200,      // 50KB
  injectionSizeLimit: 8000,     // ~2000 tokens
  features: {
    coloredOutput: true,
    goldTests: false,
    preCommitChecklist: true,
    autoDoctorCheck: false
  },
  security: {
    maxLogSize: 1024 * 1024,    // 1MB
    maxLogFiles: 3,
    failClosedForUnknownTools: true
  }
};

/**
 * Deep merge partial config into full config
 * Only merges objects, not arrays. SetuConfig-specific.
 */
function mergeConfig(
  target: SetuConfig,
  source: Partial<SetuConfig>
): SetuConfig {
  const result = { ...target };
  
  // Merge top-level primitives
  if (source.maxAttempts !== undefined) result.maxAttempts = source.maxAttempts;
  if (source.verbosity !== undefined) result.verbosity = source.verbosity;
  if (source.contextSizeLimit !== undefined) result.contextSizeLimit = source.contextSizeLimit;
  if (source.injectionSizeLimit !== undefined) result.injectionSizeLimit = source.injectionSizeLimit;
  
  // Merge features
  if (source.features) {
    result.features = { ...result.features };
    if (source.features.coloredOutput !== undefined) result.features.coloredOutput = source.features.coloredOutput;
    if (source.features.goldTests !== undefined) result.features.goldTests = source.features.goldTests;
    if (source.features.preCommitChecklist !== undefined) result.features.preCommitChecklist = source.features.preCommitChecklist;
    if (source.features.autoDoctorCheck !== undefined) result.features.autoDoctorCheck = source.features.autoDoctorCheck;
  }
  
  // Merge security
  if (source.security) {
    result.security = { ...result.security };
    if (source.security.maxLogSize !== undefined) result.security.maxLogSize = source.security.maxLogSize;
    if (source.security.maxLogFiles !== undefined) result.security.maxLogFiles = source.security.maxLogFiles;
    if (source.security.failClosedForUnknownTools !== undefined) result.security.failClosedForUnknownTools = source.security.failClosedForUnknownTools;
  }
  
  return result;
}

/**
 * Load and parse a config file
 * Returns null if file doesn't exist or is invalid
 */
function loadConfigFile(configPath: string): Partial<SetuConfig> | null {
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Basic validation - ensure it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      debugLog(`Invalid config at ${configPath}: not an object`);
      return null;
    }
    
    return parsed as Partial<SetuConfig>;
  } catch (error) {
    debugLog(`Failed to load config at ${configPath}:`, error);
    return null;
  }
}

/**
 * Load Setu configuration with priority order:
 * 1. Project config (.setu/setu.json)
 * 2. Global config (~/.config/opencode/setu.json)
 * 3. Defaults
 * 
 * @param projectDir - Project root directory
 * @returns Merged configuration
 */
export function loadSetuConfig(projectDir: string): SetuConfig {
  // Validate projectDir to prevent path traversal
  if (!projectDir || typeof projectDir !== 'string') {
    debugLog('Invalid projectDir: empty or non-string');
    return { ...DEFAULT_CONFIG };
  }
  
  // Reject null bytes and other control characters (Unicode Cc category)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control chars for security
  if (/[\x00-\x1F\x7F]/u.test(projectDir)) {
    debugLog('Invalid projectDir: contains control characters');
    return { ...DEFAULT_CONFIG };
  }
  
  // Resolve and normalize the path
  const resolvedProjectDir = resolve(projectDir);
  
  // Start with defaults
  let config = { ...DEFAULT_CONFIG };
  
  // Load global config first (lower priority)
  const globalConfigPath = join(homedir(), '.config', 'opencode', 'setu.json');
  const globalConfig = loadConfigFile(globalConfigPath);
  if (globalConfig) {
    config = mergeConfig(config, globalConfig);
    debugLog('Loaded global config from ~/.config/opencode/setu.json');
    
    // Validate after global merge (surfaces warnings for global-only configs)
    const globalValidation = validateConfig(config);
    if (!globalValidation.valid) {
      debugLog('Global config validation warnings:', globalValidation.errors);
    }
  }
  
  // Load project config (higher priority - overrides global)
  // Ensure project config path stays within project directory
  const projectConfigPath = join(resolvedProjectDir, '.setu', 'setu.json');
  const resolvedConfigPath = resolve(projectConfigPath);
  
  // Verify config path is within project directory (prevent traversal in .setu path)
  // Use isAbsolute for cross-platform check (handles Windows drive letters)
  const relPath = relative(resolvedProjectDir, resolvedConfigPath);
  if (relPath.startsWith('..') || isAbsolute(relPath)) {
    debugLog('Invalid project config path: traversal detected');
    return config;
  }
  
  const projectConfig = loadConfigFile(resolvedConfigPath);
  if (projectConfig) {
    config = mergeConfig(config, projectConfig);
    debugLog('Loaded project config from .setu/setu.json');
  }
  
  // Always validate final merged config (covers global-only, project-only, or merged)
  const validation = validateConfig(config);
  if (!validation.valid) {
    debugLog('Config validation warnings:', validation.errors);
    // Continue with the merged config - validation is informational
  }
  
  return config;
}

/**
 * Get a specific config value with validation
 */
export function getConfigValue<K extends keyof SetuConfig>(
  config: SetuConfig,
  key: K
): SetuConfig[K] {
  return config[key];
}

/**
 * Validate config values are within acceptable ranges
 */
export function validateConfig(config: SetuConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const ensureFiniteNumber = (value: unknown, label: string): value is number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${label} must be a finite number`);
      return false;
    }
    return true;
  };

  if (ensureFiniteNumber(config.maxAttempts, 'maxAttempts')) {
    if (config.maxAttempts < 1 || config.maxAttempts > 10) {
      errors.push('maxAttempts must be between 1 and 10');
    }
  }
  
  if (ensureFiniteNumber(config.contextSizeLimit, 'contextSizeLimit')) {
    if (config.contextSizeLimit < 1024 || config.contextSizeLimit > 1024 * 1024) {
      errors.push('contextSizeLimit must be between 1KB and 1MB');
    }
  }
  
  if (ensureFiniteNumber(config.injectionSizeLimit, 'injectionSizeLimit')) {
    if (config.injectionSizeLimit < 1000 || config.injectionSizeLimit > 50000) {
      errors.push('injectionSizeLimit must be between 1000 and 50000 characters');
    }
  }
  
  if (ensureFiniteNumber(config.security.maxLogSize, 'security.maxLogSize')) {
    if (config.security.maxLogSize < 10240) {
      errors.push('security.maxLogSize must be at least 10KB');
    }
  }
  
  if (ensureFiniteNumber(config.security.maxLogFiles, 'security.maxLogFiles')) {
    if (config.security.maxLogFiles < 1 || config.security.maxLogFiles > 10) {
      errors.push('security.maxLogFiles must be between 1 and 10');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Cache for loaded config (per project)
const configCache = new Map<string, { config: SetuConfig; loadedAt: number }>();
const CONFIG_CACHE_TTL_MS = 30000;  // 30 seconds

/**
 * Load config with caching (avoids repeated file reads)
 */
export function loadSetuConfigCached(projectDir: string): SetuConfig {
  const cached = configCache.get(projectDir);
  const now = Date.now();
  
  if (cached && (now - cached.loadedAt) < CONFIG_CACHE_TTL_MS) {
    return cached.config;
  }
  
  const config = loadSetuConfig(projectDir);
  configCache.set(projectDir, { config, loadedAt: now });
  
  return config;
}

/**
 * Clear config cache (useful for testing or when config is known to have changed)
 */
export function clearConfigCache(): void {
  configCache.clear();
}
