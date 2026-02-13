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
  });

  test('allows read-only bash in architect', () => {
    const result = shouldBlock('architect', 'bash', { command: 'git status' });
    expect(result.blocked).toBe(false);
  });
});
