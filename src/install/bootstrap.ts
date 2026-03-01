import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  createSetuAgentFile,
  resolveAndValidateGlobalConfigRoot,
  resolveAndValidateLegacyHomeConfigRoot,
  SETU_AGENT_VERSION_MARKER_PREFIX,
} from '../agent/setu-agent';
import { debugLog } from '../debug';
import { getErrorMessage } from '../utils/error-handling';

const SETU_PLUGIN_NAME = 'setu-opencode';
const SETU_PLUGIN_SPEC_PATTERN = /^setu-opencode(?:@.+)?$/;

export interface BootstrapResult {
  configPath: string;
  agentPath: string;
  pluginAdded: boolean;
  agentUpdated: boolean;
  warning?: string;
}

export interface UninstallResult {
  configPath: string;
  agentPath: string;
  pluginRemoved: boolean;
  agentRemoved: boolean;
  warning?: string;
}

function getGlobalOpenCodeConfigDir(): string {
  return resolveAndValidateGlobalConfigRoot();
}

function getLegacyHomeOpenCodeConfigDir(): string {
  return resolveAndValidateLegacyHomeConfigRoot();
}

interface RootPaths {
  configDir: string;
  configPath: string;
  agentPaths: string[];
}

function createRootPaths(configDir: string): RootPaths {
  return {
    configDir,
    configPath: join(configDir, 'opencode.json'),
    agentPaths: [join(configDir, 'agents', 'setu.md'), join(configDir, 'agent', 'setu.md')],
  };
}

function getGlobalRoots(): { configDir: string; configPath: string; agentPath: string } {
  const { configDir, configPath, agentPaths } = createRootPaths(getGlobalOpenCodeConfigDir());
  return {
    configDir,
    configPath,
    agentPath: agentPaths[0],
  };
}

function getAllUninstallRoots(): RootPaths[] {
  const primary = createRootPaths(getGlobalOpenCodeConfigDir());
  const roots = [primary];

  try {
    const legacy = createRootPaths(getLegacyHomeOpenCodeConfigDir());
    if (!roots.some(root => root.configDir === legacy.configDir)) {
      roots.push(legacy);
    }
  } catch (error) {
    debugLog('Skipping legacy home .opencode cleanup due to invalid root', error);
  }

  return roots;
}

function readConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {};
  }

  const content = readFileSync(configPath, 'utf-8').trim();
  if (content.length === 0) {
    return {};
  }

  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config JSON must be a non-null object');
  }

  return parsed as Record<string, unknown>;
}

function normalizePluginList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map(entry => entry.trim());
}

function isSetuPluginSpec(entry: string): boolean {
  return SETU_PLUGIN_SPEC_PATTERN.test(entry.trim());
}

function removeSetuPluginSpecs(config: Record<string, unknown>): boolean {
  const plugins = normalizePluginList(config.plugin);
  const filtered = plugins.filter(plugin => !isSetuPluginSpec(plugin));

  if (filtered.length === plugins.length) {
    return false;
  }

  config.plugin = filtered;
  return true;
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function upsertCanonicalSetuPlugin(config: Record<string, unknown>, canonicalSpec: string): boolean {
  const plugins = normalizePluginList(config.plugin);
  const filtered = plugins.filter(plugin => !isSetuPluginSpec(plugin));
  const next = [...filtered, canonicalSpec];

  const changed = !arraysEqual(plugins, next);
  config.plugin = next;
  return changed;
}

function readPackageJson(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveSetuVersionFromAncestor(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json');
    const parsed = readPackageJson(packageJsonPath);
    const name = typeof parsed?.name === 'string' ? parsed.name.trim() : '';
    const version = typeof parsed?.version === 'string' ? parsed.version.trim() : '';

    if (name === SETU_PLUGIN_NAME && version.length > 0) {
      return version;
    }

    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  return null;
}

function resolveCurrentSetuVersion(): string | null {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const fromModule = resolveSetuVersionFromAncestor(moduleDir);
  if (fromModule) {
    return fromModule;
  }

  const fromCwd = resolveSetuVersionFromAncestor(process.cwd());
  if (fromCwd) {
    return fromCwd;
  }

  if (process.env.npm_package_name === SETU_PLUGIN_NAME) {
    const envVersion = process.env.npm_package_version?.trim();
    if (envVersion) {
      return envVersion;
    }
  }

  return null;
}

function writeConfig(configPath: string, config: Record<string, unknown>): void {
  const parent = dirname(configPath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

function removePluginFromConfigPath(configPath: string): { removed: boolean; warning?: string } {
  if (!existsSync(configPath)) {
    return { removed: false };
  }

  let config: Record<string, unknown>;
  try {
    config = readConfig(configPath);
  } catch {
    return { removed: false, warning: `Could not parse existing config at ${configPath}. Please fix JSON and retry uninstall.` };
  }

  try {
    const removed = removeSetuPluginSpecs(config);
    if (removed) {
      writeConfig(configPath, config);
    }
    return { removed };
  } catch (error) {
    return {
      removed: false,
      warning: `Could not update config at ${configPath}: ${getErrorMessage(error)}. Check permissions and retry uninstall.`,
    };
  }
}

function isSetuManagedAgentContent(content: string): boolean {
  return content.includes(SETU_AGENT_VERSION_MARKER_PREFIX);
}

function removeManagedAgentFile(agentPath: string): { removed: boolean; warning?: string } {
  if (!existsSync(agentPath)) {
    return { removed: false };
  }

  let content = '';
  try {
    content = readFileSync(agentPath, 'utf-8');
  } catch (error) {
    return {
      removed: false,
      warning: `Failed to inspect agent file at ${agentPath}: ${getErrorMessage(error)}.`,
    };
  }

  if (!isSetuManagedAgentContent(content)) {
    debugLog(`Skipping unmanaged Setu agent file at ${agentPath}`);
    return { removed: false };
  }

  try {
    unlinkSync(agentPath);
    return { removed: true };
  } catch (error) {
    return {
      removed: false,
      warning: `Failed to remove agent file at ${agentPath}: ${getErrorMessage(error)}.`,
    };
  }
}

function cleanupLegacyManagedAgentFiles(primaryConfigDir: string): { removedAny: boolean; warning?: string } {
  let legacyRoot: RootPaths;
  try {
    legacyRoot = createRootPaths(getLegacyHomeOpenCodeConfigDir());
  } catch (error) {
    debugLog('Skipping legacy home .opencode cleanup due to invalid root', error);
    return { removedAny: false };
  }

  if (legacyRoot.configDir === primaryConfigDir) {
    return { removedAny: false };
  }

  let removedAny = false;
  const warnings: string[] = [];
  const dedupedAgentPaths = Array.from(new Set(legacyRoot.agentPaths));

  for (const path of dedupedAgentPaths) {
    const result = removeManagedAgentFile(path);
    if (result.removed) {
      removedAny = true;
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  if (warnings.length > 0) {
    return { removedAny, warning: warnings.join(' ') };
  }

  return { removedAny };
}

export async function bootstrapSetuGlobal(): Promise<BootstrapResult> {
  const { configDir, configPath, agentPath } = getGlobalRoots();
  const resolvedVersion = resolveCurrentSetuVersion();
  const canonicalSetuSpec = resolvedVersion ? `${SETU_PLUGIN_NAME}@${resolvedVersion}` : null;

  const warningResult = (warning: string, pluginAdded = false, agentUpdated = false): BootstrapResult => ({
    configPath,
    agentPath,
    pluginAdded,
    agentUpdated,
    warning,
  });

  let config: Record<string, unknown>;
  try {
    config = readConfig(configPath);
  } catch {
    return warningResult(
      `Could not parse existing config at ${configPath}. Please fix JSON and re-run init.`
    );
  }

  if (!canonicalSetuSpec) {
    return warningResult(
      `Could not resolve running ${SETU_PLUGIN_NAME} version for deterministic plugin setup. ` +
      'Ensure Setu is installed correctly and re-run init.'
    );
  }

  let pluginAdded = false;
  try {
    pluginAdded = upsertCanonicalSetuPlugin(config, canonicalSetuSpec);
    writeConfig(configPath, config);
  } catch (error) {
    return warningResult(
      `Could not write config at ${configPath}: ${getErrorMessage(error)}. ` +
      'Check permissions and re-run init.',
      false,
    );
  }

  let agentUpdated = false;
  try {
    agentUpdated = await createSetuAgentFile(configDir, true /* forceUpdate */, { allowedBaseDir: configDir });
  } catch (error) {
    return warningResult(
      `Config updated, but agent creation failed at ${agentPath}: ${getErrorMessage(error)}. ` +
      'Run init again after fixing filesystem permissions.',
      pluginAdded,
    );
  }

  const legacyCleanup = cleanupLegacyManagedAgentFiles(configDir);
  if (legacyCleanup.warning) {
    return warningResult(
      `Config updated, but legacy managed Setu agent cleanup could not complete: ${legacyCleanup.warning}`,
      pluginAdded,
      agentUpdated,
    );
  }

  return {
    configPath,
    agentPath,
    pluginAdded,
    agentUpdated
  };
}

export function uninstallSetuGlobal(): UninstallResult {
  const { configPath, agentPath } = getGlobalRoots();

  const warningResult = (warning: string, pluginRemoved = false, agentRemoved = false): UninstallResult => ({
    configPath,
    agentPath,
    pluginRemoved,
    agentRemoved,
    warning,
  });

  let pluginRemoved = false;
  let agentRemoved = false;
  const warnings: string[] = [];

  for (const root of getAllUninstallRoots()) {
    const pluginResult = removePluginFromConfigPath(root.configPath);
    if (pluginResult.removed) {
      pluginRemoved = true;
    }
    if (pluginResult.warning) {
      warnings.push(pluginResult.warning);
    }

    const dedupedAgentPaths = Array.from(new Set(root.agentPaths));
    for (const path of dedupedAgentPaths) {
      const agentResult = removeManagedAgentFile(path);
      if (agentResult.removed) {
        agentRemoved = true;
      }
      if (agentResult.warning) {
        warnings.push(agentResult.warning);
      }
    }
  }

  if (warnings.length > 0) {
    return warningResult(warnings.join(' '), pluginRemoved, agentRemoved);
  }

  return {
    configPath,
    agentPath,
    pluginRemoved,
    agentRemoved,
  };
}

export function isExplicitGlobalInstallEnv(): boolean {
  // Primary signal (npm v7+): explicit global install flag.
  if (process.env.npm_config_global === 'true') {
    return true;
  }

  // Legacy compatibility (npm v6): parse npm_config_argv when available.
  // Keep this defensive path for older environments and malformed payloads.
  const argvRaw = process.env.npm_config_argv;
  if (!argvRaw || argvRaw.trim().length === 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(argvRaw) as { original?: unknown };
    if (Array.isArray(parsed.original)) {
      return parsed.original.some(token => token === '-g' || token === '--global');
    }
  } catch {
    // ignore malformed npm_config_argv
  }

  return /(^|\s)(-g|--global)(\s|$)/.test(argvRaw);
}
