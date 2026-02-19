import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { createSetuAgentFile } from '../agent/setu-agent';
import { getErrorMessage } from '../utils/error-handling';

export type InitScope = 'project' | 'global';

interface BootstrapResult {
  scope: InitScope;
  configPath: string;
  agentPath: string;
  pluginAdded: boolean;
  agentUpdated: boolean;
  warning?: string;
}

function getGlobalOpenCodeConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return join(xdgConfigHome, 'opencode');
  }

  return join(homedir(), '.config', 'opencode');
}

function getRoots(scope: InitScope, cwd: string): { configDir: string; configPath: string } {
  if (scope === 'global') {
    const configDir = getGlobalOpenCodeConfigDir();
    return {
      configDir,
      configPath: join(configDir, 'opencode.json')
    };
  }

  return {
    configDir: join(cwd, '.opencode'),
    configPath: join(cwd, 'opencode.json')
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

export async function bootstrapSetu(scope: InitScope, cwd: string = process.cwd()): Promise<BootstrapResult> {
  const { configDir, configPath } = getRoots(scope, cwd);
  const agentPath = join(configDir, 'agents', 'setu.md');

  const warningResult = (warning: string, pluginAdded = false): BootstrapResult => ({
    scope,
    configPath,
    agentPath,
    pluginAdded,
    agentUpdated: false,
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
    scope,
    configPath,
    agentPath,
    pluginAdded,
    agentUpdated
  };
}

export function isLikelyGlobalInstallEnv(): boolean {
  return process.env.npm_config_global === 'true' || process.env.npm_config_location === 'global';
}
