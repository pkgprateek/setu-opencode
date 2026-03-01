import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, readFile, rm, access, chmod } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { bootstrapSetuGlobal, isExplicitGlobalInstallEnv, uninstallSetuGlobal } from '../bootstrap';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('install/bootstrap', () => {
  let testDir: string;
  let originalXdgConfigHome: string | undefined;
  let originalNpmGlobal: string | undefined;
  let originalNpmArgv: string | undefined;
  let originalHome: string | undefined;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setu-bootstrap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = testDir;

    originalNpmGlobal = process.env.npm_config_global;
    originalNpmArgv = process.env.npm_config_argv;
    originalHome = process.env.HOME;
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

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`cleanup failed for ${testDir}:`, error);
      throw error;
    }
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

  test('init always overwrites existing global setu.md', async () => {
    const first = await bootstrapSetuGlobal();
    expect(first.warning).toBeUndefined();

    const agentPath = join(testDir, 'opencode', 'agents', 'setu.md');
    await writeFile(agentPath, '# stale agent content\n', 'utf-8');

    const second = await bootstrapSetuGlobal();
    expect(second.warning).toBeUndefined();
    expect(second.agentUpdated).toBe(true);

    const updatedAgent = await readFile(agentPath, 'utf-8');
    expect(updatedAgent).toContain('setu-agent-version');
    expect(updatedAgent).not.toContain('stale agent content');
  });

  test('init removes legacy home managed setu.md to avoid shadowing', async () => {
    process.env.HOME = testDir;

    const legacyDir = join(testDir, '.opencode');
    await mkdir(join(legacyDir, 'agents'), { recursive: true });
    await mkdir(join(legacyDir, 'agent'), { recursive: true });
    await writeFile(join(legacyDir, 'agents', 'setu.md'), '<!-- setu-agent-version: 0.9.0 -->\nlegacy\n', 'utf-8');
    await writeFile(join(legacyDir, 'agent', 'setu.md'), '<!-- setu-agent-version: 0.9.0 -->\nlegacy singular\n', 'utf-8');

    const result = await bootstrapSetuGlobal();
    expect(result.warning).toBeUndefined();

    expect(await fileExists(join(testDir, 'opencode', 'agents', 'setu.md'))).toBe(true);
    expect(await fileExists(join(legacyDir, 'agents', 'setu.md'))).toBe(false);
    expect(await fileExists(join(legacyDir, 'agent', 'setu.md'))).toBe(false);
  });

  test('init keeps unmanaged legacy home setu.md untouched', async () => {
    process.env.HOME = testDir;

    const legacyDir = join(testDir, '.opencode');
    await mkdir(join(legacyDir, 'agents'), { recursive: true });
    const customAgentPath = join(legacyDir, 'agents', 'setu.md');
    await writeFile(customAgentPath, '# custom setu profile\n', 'utf-8');

    const result = await bootstrapSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(await fileExists(customAgentPath)).toBe(true);
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

  test('uninstall does not rewrite config when Setu plugin is absent', async () => {
    const configDir = join(testDir, 'opencode');
    const configPath = join(configDir, 'opencode.json');
    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, '{"plugin": ["other-plugin"]}\n', 'utf-8');
    await chmod(configPath, 0o444);

    const result = uninstallSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(result.pluginRemoved).toBe(false);
    expect(result.agentRemoved).toBe(false);

    const config = await readFile(configPath, 'utf-8');
    expect(config).toContain('other-plugin');
    expect(config).not.toContain('setu-opencode');
  });

  test('uninstall also removes legacy home .opencode managed wiring', async () => {
    process.env.HOME = testDir;

    const setup = await bootstrapSetuGlobal();
    expect(setup.warning).toBeUndefined();

    const legacyDir = join(testDir, '.opencode');
    await mkdir(join(legacyDir, 'agents'), { recursive: true });
    await mkdir(join(legacyDir, 'agent'), { recursive: true });
    await writeFile(join(legacyDir, 'opencode.json'), '{"plugin": ["setu-opencode", "other-plugin"]}\n', 'utf-8');
    await writeFile(join(legacyDir, 'agents', 'setu.md'), '<!-- setu-agent-version: 0.9.0 -->\nlegacy\n', 'utf-8');
    await writeFile(join(legacyDir, 'agent', 'setu.md'), '<!-- setu-agent-version: 0.9.0 -->\nlegacy singular\n', 'utf-8');

    const result = uninstallSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(result.pluginRemoved).toBe(true);
    expect(result.agentRemoved).toBe(true);

    const globalConfig = await readFile(join(testDir, 'opencode', 'opencode.json'), 'utf-8');
    expect(globalConfig).not.toContain('setu-opencode');

    const legacyConfig = await readFile(join(legacyDir, 'opencode.json'), 'utf-8');
    expect(legacyConfig).not.toContain('setu-opencode');
    expect(legacyConfig).toContain('other-plugin');

    expect(await fileExists(join(legacyDir, 'agents', 'setu.md'))).toBe(false);
    expect(await fileExists(join(legacyDir, 'agent', 'setu.md'))).toBe(false);
  });

  test('uninstall keeps unmanaged legacy setu.md untouched', async () => {
    process.env.HOME = testDir;

    const legacyDir = join(testDir, '.opencode');
    await mkdir(join(legacyDir, 'agents'), { recursive: true });
    const customAgentPath = join(legacyDir, 'agents', 'setu.md');
    await writeFile(customAgentPath, '# custom setu profile\n', 'utf-8');

    const result = uninstallSetuGlobal();
    expect(result.warning).toBeUndefined();
    expect(result.pluginRemoved).toBe(false);
    expect(result.agentRemoved).toBe(false);
    expect(await fileExists(customAgentPath)).toBe(true);
  });
});
