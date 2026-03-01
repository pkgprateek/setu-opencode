import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { debugLog } from '../debug';

const SETU_PACKAGE_NAME = 'setu-opencode';
const DEFAULT_TIMEOUT_MS = 5000;

interface DistTagsResponse {
  latest?: string;
}

interface CachePackageJson {
  dependencies?: Record<string, string>;
}

interface PluginPackageJson {
  version?: string;
}

interface OpenCodePaths {
  cacheDir: string;
}

interface LatestVersionFetcherResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

type LatestVersionFetcher = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> }
) => Promise<LatestVersionFetcherResponse>;

type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
) => Promise<CommandResult>;

export interface SessionEventLike {
  type: string;
  properties?: Record<string, unknown>;
}

export interface AutoUpdateOptions {
  packageName?: string;
  paths?: OpenCodePaths;
  fetcher?: LatestVersionFetcher;
  timeoutMs?: number;
  commandRunner?: CommandRunner;
}

export interface AutoUpdateResult {
  checked: boolean;
  updated: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  reason:
    | 'no_cached_version'
    | 'latest_unavailable'
    | 'up_to_date'
    | 'install_failed'
    | 'init_failed'
    | 'updated_and_refreshed';
}

function coalesceNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export function resolveOpenCodePaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = homedir()
): OpenCodePaths {
  if (platform === 'win32') {
    const cacheBase = coalesceNonEmpty(env.LOCALAPPDATA, homeDir) ?? homeDir;

    return {
      cacheDir: join(cacheBase, 'opencode')
    };
  }

  const cacheBase = coalesceNonEmpty(env.XDG_CACHE_HOME, join(homeDir, '.cache')) ?? join(homeDir, '.cache');

  return {
    cacheDir: join(cacheBase, 'opencode')
  };
}

function stripTrailingCommas(input: string): string {
  return input.replace(/,(\s*[}\]])/g, '$1');
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(stripTrailingCommas(content)) as T;
  } catch (error) {
    debugLog(`Auto-update: failed to parse JSON from ${filePath}`, error);
    return null;
  }
}

async function getCachedPluginVersion(cacheDir: string, packageName: string): Promise<string | null> {
  const packageJsonPath = join(cacheDir, 'node_modules', packageName, 'package.json');
  const parsed = await readJsonFile<PluginPackageJson>(packageJsonPath);
  const version = parsed?.version;
  return typeof version === 'string' && version.trim().length > 0 ? version.trim() : null;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemver(version: string): ParsedVersion | null {
  const trimmed = version.trim();
  const withoutBuild = trimmed.split('+', 1)[0];
  const [core, prereleaseRaw] = withoutBuild.split('-', 2);
  const parts = core.split('.');

  if (parts.length < 1 || parts.length > 3) {
    return null;
  }

  const [majorRaw, minorRaw = '0', patchRaw = '0'] = parts;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);

  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }

  if (major < 0 || minor < 0 || patch < 0) {
    return null;
  }

  const prerelease = prereleaseRaw ? prereleaseRaw.split('.').filter(token => token.length > 0) : [];
  return { major, minor, patch, prerelease };
}

function comparePrereleaseToken(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftNumeric = Number.isInteger(leftNumber) && `${leftNumber}` === left;
  const rightNumeric = Number.isInteger(rightNumber) && `${rightNumber}` === right;

  if (leftNumeric && rightNumeric) {
    if (leftNumber < rightNumber) return -1;
    if (leftNumber > rightNumber) return 1;
    return 0;
  }

  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareVersions(currentVersion: string, latestVersion: string): number {
  const current = parseSemver(currentVersion);
  const latest = parseSemver(latestVersion);

  if (!current || !latest) {
    if (currentVersion === latestVersion) return 0;
    return currentVersion < latestVersion ? -1 : 1;
  }

  if (current.major !== latest.major) return current.major < latest.major ? -1 : 1;
  if (current.minor !== latest.minor) return current.minor < latest.minor ? -1 : 1;
  if (current.patch !== latest.patch) return current.patch < latest.patch ? -1 : 1;

  if (current.prerelease.length === 0 && latest.prerelease.length === 0) return 0;
  if (current.prerelease.length === 0) return 1;
  if (latest.prerelease.length === 0) return -1;

  const maxLength = Math.max(current.prerelease.length, latest.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = current.prerelease[index];
    const right = latest.prerelease[index];

    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const tokenComparison = comparePrereleaseToken(left, right);
    if (tokenComparison !== 0) {
      return tokenComparison;
    }
  }

  return 0;
}

async function fetchLatestVersion(
  packageName: string,
  timeoutMs: number,
  fetcher: LatestVersionFetcher
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(`https://registry.npmjs.org/-/package/${packageName}/dist-tags`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as DistTagsResponse;
    const latest = body.latest;
    return typeof latest === 'string' && latest.trim().length > 0 ? latest.trim() : null;
  } catch (error) {
    debugLog('Auto-update: failed to fetch latest package version', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function defaultCommandRunner(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on('error', (error) => {
      resolve({
        code: 1,
        stdout: '',
        stderr: String(error)
      });
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8')
      });
    });
  });
}

async function ensureCachePackageJson(cacheDir: string): Promise<void> {
  const packageJsonPath = join(cacheDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    return;
  }

  await mkdir(cacheDir, { recursive: true });
  const fallback: CachePackageJson = { dependencies: {} };
  await writeFile(packageJsonPath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf-8');
}

async function installLatestPackageInCache(
  cacheDir: string,
  packageName: string,
  commandRunner: CommandRunner
): Promise<boolean> {
  await ensureCachePackageJson(cacheDir);

  const result = await commandRunner(
    process.execPath,
    ['add', '--force', '--exact', '--cwd', cacheDir, `${packageName}@latest`],
    {
      cwd: cacheDir,
      env: {
        ...process.env,
        BUN_BE_BUN: '1'
      }
    }
  );

  if (result.code !== 0) {
    debugLog('Auto-update: failed to install latest package in cache', {
      code: result.code,
      stderr: result.stderr,
      stdout: result.stdout
    });
    return false;
  }

  return true;
}

async function runInstalledSetuInit(
  cacheDir: string,
  packageName: string,
  commandRunner: CommandRunner
): Promise<boolean> {
  const cliPath = join(cacheDir, 'node_modules', packageName, 'dist', 'cli.js');
  if (!existsSync(cliPath)) {
    debugLog('Auto-update: installed CLI not found for init', { cliPath });
    return false;
  }

  const result = await commandRunner(
    process.execPath,
    ['run', cliPath, 'init'],
    {
      cwd: cacheDir,
      env: {
        ...process.env,
        BUN_BE_BUN: '1'
      }
    }
  );

  if (result.code !== 0) {
    debugLog('Auto-update: installed setu init failed', {
      code: result.code,
      stderr: result.stderr,
      stdout: result.stdout
    });
    return false;
  }

  return true;
}

export async function checkAndPrepareSetuUpdate(options: AutoUpdateOptions = {}): Promise<AutoUpdateResult> {
  const packageName = options.packageName ?? SETU_PACKAGE_NAME;
  const paths = options.paths ?? resolveOpenCodePaths();
  const fetcher = options.fetcher ?? (fetch as unknown as LatestVersionFetcher);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const commandRunner = options.commandRunner ?? defaultCommandRunner;

  const currentVersion = await getCachedPluginVersion(paths.cacheDir, packageName);
  if (!currentVersion) {
    return {
      checked: true,
      updated: false,
      currentVersion: null,
      latestVersion: null,
      reason: 'no_cached_version'
    };
  }

  const latestVersion = await fetchLatestVersion(packageName, timeoutMs, fetcher);
  if (!latestVersion) {
    return {
      checked: true,
      updated: false,
      currentVersion,
      latestVersion: null,
      reason: 'latest_unavailable'
    };
  }

  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return {
      checked: true,
      updated: false,
      currentVersion,
      latestVersion,
      reason: 'up_to_date'
    };
  }

  const installed = await installLatestPackageInCache(paths.cacheDir, packageName, commandRunner);
  if (!installed) {
    return {
      checked: true,
      updated: false,
      currentVersion,
      latestVersion,
      reason: 'install_failed'
    };
  }

  const installedVersion = await getCachedPluginVersion(paths.cacheDir, packageName);
  if (!installedVersion || compareVersions(installedVersion, latestVersion) < 0) {
    return {
      checked: true,
      updated: false,
      currentVersion,
      latestVersion,
      reason: 'install_failed'
    };
  }

  const initUpdated = await runInstalledSetuInit(paths.cacheDir, packageName, commandRunner);
  if (!initUpdated) {
    return {
      checked: true,
      updated: false,
      currentVersion,
      latestVersion,
      reason: 'init_failed'
    };
  }

  return {
    checked: true,
    updated: true,
    currentVersion,
    latestVersion,
    reason: 'updated_and_refreshed'
  };
}

function readParentId(properties: Record<string, unknown> | undefined): string | null {
  if (!properties) return null;

  const directParent = properties.parentID;
  if (typeof directParent === 'string' && directParent.trim().length > 0) {
    return directParent;
  }

  const info = properties.info;
  if (!info || typeof info !== 'object') {
    return null;
  }

  const infoParent = (info as Record<string, unknown>).parentID;
  if (typeof infoParent === 'string' && infoParent.trim().length > 0) {
    return infoParent;
  }

  return null;
}

export function isRootSessionCreatedEvent(event: SessionEventLike): boolean {
  if (event.type !== 'session.created') {
    return false;
  }

  return readParentId(event.properties) === null;
}
