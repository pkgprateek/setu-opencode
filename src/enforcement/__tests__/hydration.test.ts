import { describe, expect, test } from 'bun:test';
import { isReadOnlyBashCommand, shouldBlockDuringHydration } from '../hydration';

describe('hydration bash safety parsing', () => {
  test('rejects chained shell commands as non-read-only', () => {
    expect(isReadOnlyBashCommand('git status && rm -rf /tmp/x')).toBe(false);
    expect(isReadOnlyBashCommand('cat file.txt; echo hacked')).toBe(false);
  });

  test('rejects redirect operators as non-read-only', () => {
    expect(isReadOnlyBashCommand('echo hi > out.txt')).toBe(false);
    expect(isReadOnlyBashCommand('echo hi >> out.txt')).toBe(false);
    expect(isReadOnlyBashCommand('cat < /etc/passwd')).toBe(false);
  });

  test('rejects shell injection vectors', () => {
    expect(isReadOnlyBashCommand('ls | cat')).toBe(false);
    expect(isReadOnlyBashCommand('$(rm -rf /)')).toBe(false);
    expect(isReadOnlyBashCommand('`rm -rf /`')).toBe(false);
    expect(isReadOnlyBashCommand('(rm -rf /)')).toBe(false);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: test null-byte hardening
    expect(isReadOnlyBashCommand('git status\x00rm -rf /')).toBe(false);
  });

  test('accepts benign read-only commands', () => {
    expect(isReadOnlyBashCommand('git status')).toBe(true);
    expect(isReadOnlyBashCommand('cat file.txt')).toBe(true);
    expect(isReadOnlyBashCommand('ls -la')).toBe(true);
    expect(isReadOnlyBashCommand('pwd')).toBe(true);
  });

  test('blocks bash when command argument is not a string', () => {
    const result = shouldBlockDuringHydration('bash', { command: ['git', 'status'] });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('invalid_command_type');
  });
});
