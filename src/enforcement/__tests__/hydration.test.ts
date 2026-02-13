import { describe, expect, test } from 'bun:test';
import { isReadOnlyBashCommand, shouldBlockDuringHydration } from '../hydration';

describe('hydration bash safety parsing', () => {
  test('rejects chained shell commands as non-read-only', () => {
    expect(isReadOnlyBashCommand('git status && rm -rf /tmp/x')).toBe(false);
    expect(isReadOnlyBashCommand('cat file.txt; echo hacked')).toBe(false);
  });

  test('rejects redirected command as non-read-only', () => {
    expect(isReadOnlyBashCommand('echo hi > out.txt')).toBe(false);
  });

  test('blocks bash when command argument is not a string', () => {
    const result = shouldBlockDuringHydration('bash', { command: ['git', 'status'] });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('invalid_command_type');
  });
});
