import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { checkAndPrepareSetuUpdate, isRootSessionCreatedEvent, resolveOpenCodePaths } from '../auto-update';

describe('update/auto-update', () => {
  let testRoot: string;
  let cacheDir: string;

  beforeEach(async () => {
    testRoot = join(tmpdir(), `setu-auto-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    cacheDir = join(testRoot, 'cache');
    await mkdir(cacheDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  async function createCacheFixture(version: string): Promise<void> {
    await mkdir(join(cacheDir, 'node_modules', 'setu-opencode', 'dist'), { recursive: true });

    await writeFile(
      join(cacheDir, 'node_modules', 'setu-opencode', 'package.json'),
      `${JSON.stringify({ name: 'setu-opencode', version }, null, 2)}\n`,
      'utf-8'
    );

    await writeFile(
      join(cacheDir, 'node_modules', 'setu-opencode', 'dist', 'cli.js'),
      'console.log("setu cli");\n',
      'utf-8'
    );

    await writeFile(
      join(cacheDir, 'package.json'),
      `${JSON.stringify({ dependencies: { 'setu-opencode': version } }, null, 2)}\n`,
      'utf-8'
    );
  }

  test('installs latest and runs init when newer version exists', async () => {
    await createCacheFixture('1.0.0');

    const calls: string[] = [];
    const commandRunner = async (_command: string, args: string[]) => {
      calls.push(args.join(' '));

      if (args.includes('add')) {
        await writeFile(
          join(cacheDir, 'node_modules', 'setu-opencode', 'package.json'),
          `${JSON.stringify({ name: 'setu-opencode', version: '1.1.0' }, null, 2)}\n`,
          'utf-8'
        );
      }

      return { code: 0, stdout: '', stderr: '' };
    };

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      }),
      commandRunner
    });

    expect(result.updated).toBe(true);
    expect(result.reason).toBe('updated_and_refreshed');
    expect(result.latestVersion).toBe('1.1.0');
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('add --force --exact');
    expect(calls[1]).toContain('run');
    expect(calls[1]).toContain('dist/cli.js init');
  });

  test('returns install_failed when package install command fails', async () => {
    await createCacheFixture('1.0.0');

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      }),
      commandRunner: async () => ({ code: 1, stdout: '', stderr: 'install failed' })
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('install_failed');
  });

  test('returns init_failed when init command fails after successful install', async () => {
    await createCacheFixture('1.0.0');

    let commandCount = 0;
    const commandRunner = async (_command: string, args: string[]) => {
      commandCount += 1;

      if (args.includes('add')) {
        await writeFile(
          join(cacheDir, 'node_modules', 'setu-opencode', 'package.json'),
          `${JSON.stringify({ name: 'setu-opencode', version: '1.1.0' }, null, 2)}\n`,
          'utf-8'
        );
        return { code: 0, stdout: '', stderr: '' };
      }

      return { code: 1, stdout: '', stderr: 'init failed' };
    };

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      }),
      commandRunner
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('init_failed');
    expect(commandCount).toBe(2);
  });

  test('returns latest_unavailable when npm dist-tags cannot be fetched', async () => {
    await createCacheFixture('1.0.0');

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: false,
        json: async () => ({})
      })
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('latest_unavailable');
  });

  test('returns up_to_date when cache is already latest', async () => {
    await createCacheFixture('1.1.0');

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      })
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('up_to_date');
  });

  test('resolves OpenCode paths with XDG and Windows envs', () => {
    const xdgPaths = resolveOpenCodePaths(
      {
        XDG_CACHE_HOME: '/tmp/xcache',
        XDG_CONFIG_HOME: '/tmp/xconfig'
      },
      'linux',
      '/home/dev'
    );
    expect(xdgPaths.cacheDir).toBe(join('/tmp/xcache', 'opencode'));

    const winPaths = resolveOpenCodePaths(
      {
        LOCALAPPDATA: 'C:/Users/dev/AppData/Local',
        APPDATA: 'C:/Users/dev/AppData/Roaming'
      },
      'win32',
      'C:/Users/dev'
    );
    expect(winPaths.cacheDir).toContain('opencode');
  });

  test('detects root session.created events only', () => {
    expect(isRootSessionCreatedEvent({ type: 'session.created' })).toBe(true);
    expect(
      isRootSessionCreatedEvent({
        type: 'session.created',
        properties: { info: { parentID: 'abc123' } }
      })
    ).toBe(false);
    expect(isRootSessionCreatedEvent({ type: 'session.deleted' })).toBe(false);
  });

  test('returns no_cached_version when plugin package is missing', async () => {
    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      })
    });

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('no_cached_version');
  });

  test('creates cache package.json when missing before install', async () => {
    await mkdir(join(cacheDir, 'node_modules', 'setu-opencode', 'dist'), { recursive: true });
    await writeFile(
      join(cacheDir, 'node_modules', 'setu-opencode', 'package.json'),
      `${JSON.stringify({ name: 'setu-opencode', version: '1.0.0' }, null, 2)}\n`,
      'utf-8'
    );
    await writeFile(join(cacheDir, 'node_modules', 'setu-opencode', 'dist', 'cli.js'), 'x\n', 'utf-8');

    const result = await checkAndPrepareSetuUpdate({
      paths: { cacheDir },
      fetcher: async () => ({
        ok: true,
        json: async () => ({ latest: '1.1.0' })
      }),
      commandRunner: async (_command, args) => {
        if (args.includes('add')) {
          await writeFile(
            join(cacheDir, 'node_modules', 'setu-opencode', 'package.json'),
            `${JSON.stringify({ name: 'setu-opencode', version: '1.1.0' }, null, 2)}\n`,
            'utf-8'
          );
        }
        return { code: 0, stdout: '', stderr: '' };
      }
    });

    const cachePkg = JSON.parse(await readFile(join(cacheDir, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
    };
    expect(cachePkg.dependencies).toBeDefined();
    expect(result.reason).toBe('updated_and_refreshed');
  });
});
