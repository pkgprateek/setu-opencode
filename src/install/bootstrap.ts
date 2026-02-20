import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { createSetuAgentFile } from '../agent/setu-agent';
import { getErrorMessage } from '../utils/error-handling';

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
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return join(xdgConfigHome, 'opencode');
  }

  return join(homedir(), '.config', 'opencode');
}

function getGlobalRoots(): { configDir: string; configPath: string; agentPath: string } {
  const configDir = getGlobalOpenCodeConfigDir();
  return {
    configDir,
    configPath: join(configDir, 'opencode.json'),
    agentPath: join(configDir, 'agents', 'setu.md'),
  };
}

function readConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {};
  }

  const content = readFileSync(configPath, 'utf-8').trim();
  if (content.length === 0) {
    return {};
  }

  return JSON.parse(content) as Record<string, unknown>;
}

function normalizePluginList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map(entry => entry.trim());
}

function removePlugin(config: Record<string, unknown>, pluginName: string): boolean {
  const plugins = normalizePluginList(config.plugin);
  if (!plugins.includes(pluginName)) {
    config.plugin = plugins;
    return false;
  }

  config.plugin = plugins.filter(plugin => plugin !== pluginName);
  return true;
}

function upsertPlugin(config: Record<string, unknown>, pluginName: string): boolean {
  const plugins = normalizePluginList(config.plugin);
  if (plugins.includes(pluginName)) {
    config.plugin = plugins;
    return false;
  }

  config.plugin = [...plugins, pluginName];
  return true;
}

function writeConfig(configPath: string, config: Record<string, unknown>): void {
  const parent = dirname(configPath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}

export async function bootstrapSetuGlobal(): Promise<BootstrapResult> {
  const { configDir, configPath, agentPath } = getGlobalRoots();

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

  let pluginAdded = false;
  try {
    pluginAdded = upsertPlugin(config, 'setu-opencode');
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
    agentUpdated = await createSetuAgentFile(configDir);
  } catch (error) {
    return warningResult(
      `Config updated, but agent creation failed at ${agentPath}: ${getErrorMessage(error)}. ` +
      'Run init again after fixing filesystem permissions.',
      pluginAdded,
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
  if (existsSync(configPath)) {
    let config: Record<string, unknown>;
    try {
      config = readConfig(configPath);
    } catch {
      return warningResult(`Could not parse existing config at ${configPath}. Please fix JSON and retry uninstall.`);
    }

    try {
      pluginRemoved = removePlugin(config, 'setu-opencode');
      writeConfig(configPath, config);
    } catch (error) {
      return warningResult(
        `Could not update config at ${configPath}: ${getErrorMessage(error)}. ` +
        'Check permissions and retry uninstall.',
        false,
        false,
      );
    }
  }

  let agentRemoved = false;
  try {
    if (existsSync(agentPath)) {
      unlinkSync(agentPath);
      agentRemoved = true;
    }
  } catch (error) {
    return warningResult(
      `Config updated, but failed to remove agent file at ${agentPath}: ${getErrorMessage(error)}.`,
      pluginRemoved,
      false,
    );
  }

  return {
    configPath,
    agentPath,
    pluginRemoved,
    agentRemoved,
  };
}

export function isExplicitGlobalInstallEnv(): boolean {
  if (process.env.npm_config_global === 'true') {
    return true;
  }

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
