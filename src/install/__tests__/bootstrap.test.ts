import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { bootstrapSetuGlobal, isExplicitGlobalInstallEnv, uninstallSetuGlobal } from '../bootstrap';

describe('install/bootstrap', () => {
  let testDir: string;
  let originalXdgConfigHome: string | undefined;
  let originalNpmGlobal: string | undefined;
  let originalNpmArgv: string | undefined;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setu-bootstrap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = testDir;

    originalNpmGlobal = process.env.npm_config_global;
    originalNpmArgv = process.env.npm_config_argv;
    delete process.env.npm_config_global;
    delete process.env.npm_config_argv;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }

    if (originalNpmGlobal === undefined) {
      delete process.env.npm_config_global;
    } else {
      process.env.npm_config_global = originalNpmGlobal;
    }

    if (originalNpmArgv === undefined) {
      delete process.env.npm_config_argv;
    } else {
      process.env.npm_config_argv = originalNpmArgv;
    }

    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  test('detects explicit global install via npm_config_global=true', () => {
    process.env.npm_config_global = 'true';
    expect(isExplicitGlobalInstallEnv()).toBe(true);
  });

  test('detects explicit global install via npm_config_argv flags', () => {
    process.env.npm_config_argv = JSON.stringify({ original: ['install', '--global', 'setu-opencode'] });
    expect(isExplicitGlobalInstallEnv()).toBe(true);
  });

  test('does not treat missing explicit flags as global install', () => {
    process.env.npm_config_argv = JSON.stringify({ original: ['install', 'setu-opencode'] });
    expect(isExplicitGlobalInstallEnv()).toBe(false);
  });

  test('returns warning on malformed config JSON', async () => {
    const configPath = join(testDir, 'opencode', 'opencode.json');
    await mkdir(join(testDir, 'opencode'), { recursive: true });
    await writeFile(configPath, '{ invalid-json', 'utf-8');

    const result = await bootstrapSetuGlobal();
    expect(result.warning).toContain('Could not parse existing config');
    expect(result.pluginAdded).toBe(false);
    expect(result.agentUpdated).toBe(false);
  });

  test('returns warning with pluginAdded false when config write fails', async () => {
    // Make opencode dir path a file so writing opencode.json fails with ENOTDIR.
    await writeFile(join(testDir, 'opencode'), 'not-a-directory', 'utf-8');

    const result = await bootstrapSetuGlobal();

    expect(result.warning).toContain('Could not write config');
    expect(result.pluginAdded).toBe(false);
    expect(result.agentUpdated).toBe(false);
  });

  test('returns warning when agent creation fails after config update', async () => {
    await mkdir(join(testDir, 'opencode'), { recursive: true });
    await writeFile(join(testDir, 'opencode', 'opencode.json'), '{"plugin": []}\n', 'utf-8');

    // Force createSetuAgentFile failure: opencode/agents is a file, not directory.
    await writeFile(join(testDir, 'opencode', 'agents'), 'file-not-dir', 'utf-8');

    const result = await bootstrapSetuGlobal();

    expect(result.warning).toContain('agent creation failed');
    expect(result.pluginAdded).toBe(true);
    expect(result.agentUpdated).toBe(false);

    const updatedConfig = await readFile(join(testDir, 'opencode', 'opencode.json'), 'utf-8');
    expect(updatedConfig).toContain('setu-opencode');
  });

  test('succeeds on happy path', async () => {
    const result = await bootstrapSetuGlobal();

    expect(result.warning).toBeUndefined();
    expect(result.configPath).toBe(join(testDir, 'opencode', 'opencode.json'));
    expect(result.agentPath).toBe(join(testDir, 'opencode', 'agents', 'setu.md'));

    const config = await readFile(join(testDir, 'opencode', 'opencode.json'), 'utf-8');
    expect(config).toContain('setu-opencode');
  });

  test('uninstall removes plugin and agent wiring', async () => {
    const setup = await bootstrapSetuGlobal();
    expect(setup.warning).toBeUndefined();

    const result = uninstallSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(result.pluginRemoved).toBe(true);
    expect(result.agentRemoved).toBe(true);

    const config = await readFile(join(testDir, 'opencode', 'opencode.json'), 'utf-8');
    expect(config).not.toContain('setu-opencode');
  });

  test('uninstall is idempotent when wiring already absent', () => {
    const result = uninstallSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(result.pluginRemoved).toBe(false);
    expect(result.agentRemoved).toBe(false);
  });
});
