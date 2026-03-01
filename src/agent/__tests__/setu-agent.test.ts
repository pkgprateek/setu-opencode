import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { resolveAndValidateGlobalConfigRoot } from '../setu-agent';

describe('agent/setu-agent global config root resolution', () => {
  test('uses XDG_CONFIG_HOME on non-windows platforms', () => {
    const root = resolveAndValidateGlobalConfigRoot({
      platform: 'linux',
      homeDir: '/home/dev',
      env: {
        XDG_CONFIG_HOME: '/custom/config',
      },
    });

    expect(root).toBe('/custom/config/opencode');
  });

  test('falls back to ~/.config on non-windows platforms', () => {
    const root = resolveAndValidateGlobalConfigRoot({
      platform: 'linux',
      homeDir: '/home/dev',
      env: {},
    });

    expect(root).toBe('/home/dev/.config/opencode');
  });

  test('uses APPDATA on windows platforms', () => {
    const root = resolveAndValidateGlobalConfigRoot({
      platform: 'win32',
      homeDir: '/home/dev',
      env: {
        APPDATA: '/roaming',
      },
    });

    expect(root).toBe('/roaming/opencode');
  });

  test('falls back to home/AppData/Roaming on windows platforms', () => {
    const root = resolveAndValidateGlobalConfigRoot({
      platform: 'win32',
      homeDir: '/home/dev',
      env: {},
    });

    expect(root).toBe(join('/home/dev', 'AppData', 'Roaming', 'opencode'));
  });

  test('rejects traversal segments in APPDATA', () => {
    expect(() =>
      resolveAndValidateGlobalConfigRoot({
        platform: 'win32',
        homeDir: '/home/dev',
        env: {
          APPDATA: '/safe/../escape',
        },
      })
    ).toThrow('Invalid global config root');
  });

  test('rejects traversal segments in XDG_CONFIG_HOME', () => {
    expect(() =>
      resolveAndValidateGlobalConfigRoot({
        platform: 'linux',
        homeDir: '/home/dev',
        env: {
          XDG_CONFIG_HOME: '/safe/../escape',
        },
      })
    ).toThrow('Invalid global config root');
  });

  test('rejects empty homeDir when explicitly provided', () => {
    expect(() =>
      resolveAndValidateGlobalConfigRoot({
        platform: 'linux',
        homeDir: '   ',
        env: {},
      })
    ).toThrow('Invalid homeDir');
  });
});
