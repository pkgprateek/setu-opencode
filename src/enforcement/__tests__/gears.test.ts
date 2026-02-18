import { describe, expect, test } from 'bun:test';
import { shouldBlock } from '../gears';

describe('gear policy read-only bash handling', () => {
  test('allows read-only bash in scout', () => {
    const result = shouldBlock('scout', 'bash', { command: 'git status' });
    expect(result.blocked).toBe(false);
  });

  test('blocks mutating bash in scout', () => {
    const result = shouldBlock('scout', 'bash', { command: 'git commit -m "x"' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.details?.toLowerCase()).toContain('blocked');
  });

  test('allows read-only bash in architect', () => {
    const result = shouldBlock('architect', 'bash', { command: 'git status' });
    expect(result.blocked).toBe(false);
  });

  test('blocks mutating bash in architect', () => {
    const result = shouldBlock('architect', 'bash', { command: 'git commit -m "x"' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.details?.toLowerCase()).toContain('blocked');
  });

  test('allows mutating bash in builder', () => {
    const result = shouldBlock('builder', 'bash', { command: 'git commit -m "x"' });
    expect(result.blocked).toBe(false);
  });

  test('allows unknown non-side-effect tools in scout (research freedom)', () => {
    // Unknown tools that aren't side-effect (write/edit/patch) are allowed
    // This enables research tools, MCPs, plugins without hardcoding names
    const result = shouldBlock('scout', 'weirdtool', {});
    expect(result.blocked).toBe(false);
  });

  test('blocks side-effect tools in scout', () => {
    const result = shouldBlock('scout', 'write', { filePath: 'test.txt', content: 'x' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('scout_blocked');
  });

  test('blocks unknown gear (fail-closed)', () => {
    const result = shouldBlock('unknown' as unknown as 'scout', 'bash', { command: 'ls' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('unknown_gear');
    expect(result.details?.toLowerCase()).toContain('not recognized');
  });

  test('architect gear permits writes to .setu/ paths', () => {
    // Architect gear should allow mutating actions targeting .setu/ paths
    // This tests the explicit !isSetuPath(args) carve-out in gears.ts
    const result = shouldBlock('architect', 'write', { filePath: '.setu/RESEARCH.md', content: 'test' });
    expect(result.blocked).toBe(false);
  });

  test('architect gear blocks writes outside .setu/', () => {
    // Architect gear should block writes to paths outside .setu/
    const result = shouldBlock('architect', 'write', { filePath: 'src/main.ts', content: 'test' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('architect_blocked');
  });
});
