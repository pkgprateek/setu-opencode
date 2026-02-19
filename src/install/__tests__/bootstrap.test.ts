import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { bootstrapSetu } from '../bootstrap';

describe('bootstrapSetu', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `setu-bootstrap-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  test('returns warning on malformed config JSON', async () => {
    const configPath = join(testDir, 'opencode.json');
    await writeFile(configPath, '{ invalid-json', 'utf-8');

    const result = await bootstrapSetu('project', testDir);
    expect(result.warning).toContain('Could not parse existing config');
    expect(result.pluginAdded).toBe(false);
    expect(result.agentUpdated).toBe(false);
  });

  test('returns warning with pluginAdded false when config write fails', async () => {
    // Make cwd a file path so writing <cwd>/opencode.json fails with ENOTDIR.
    const badCwdPath = join(testDir, 'cwd-as-file');
    await writeFile(badCwdPath, 'not-a-directory', 'utf-8');

    const result = await bootstrapSetu('project', badCwdPath);

    expect(result.warning).toContain('Could not write config');
    expect(result.pluginAdded).toBe(false);
    expect(result.agentUpdated).toBe(false);
  });

  test('returns warning when agent creation fails after config update', async () => {
    await writeFile(join(testDir, 'opencode.json'), '{"plugin": []}\n', 'utf-8');

    // Force createSetuAgentFile failure: .opencode/agents is a file, not directory.
    await mkdir(join(testDir, '.opencode'), { recursive: true });
    await writeFile(join(testDir, '.opencode', 'agents'), 'file-not-dir', 'utf-8');

    const result = await bootstrapSetu('project', testDir);

    expect(result.warning).toContain('agent creation failed');
    expect(result.pluginAdded).toBe(true);
    expect(result.agentUpdated).toBe(false);

    const updatedConfig = await readFile(join(testDir, 'opencode.json'), 'utf-8');
    expect(updatedConfig).toContain('setu-opencode');
  });

  test('succeeds on happy path', async () => {
    const result = await bootstrapSetu('project', testDir);

    expect(result.warning).toBeUndefined();
    expect(result.configPath).toBe(join(testDir, 'opencode.json'));
    expect(result.agentPath).toBe(join(testDir, '.opencode', 'agents', 'setu.md'));

    const config = await readFile(join(testDir, 'opencode.json'), 'utf-8');
    expect(config).toContain('setu-opencode');
  });
});
