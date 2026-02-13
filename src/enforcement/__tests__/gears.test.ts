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

  test('blocks unknown tools by default in scout (fail-closed)', () => {
    const result = shouldBlock('scout', 'weirdtool', {});
    expect(result.blocked).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.details?.toLowerCase()).toContain('blocked');
  });

  test('blocks unknown gear (fail-closed)', () => {
    const result = shouldBlock('unknown' as unknown as 'scout', 'bash', { command: 'ls' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('unknown_gear');
    expect(result.details?.toLowerCase()).toContain('not recognized');
  });
});
