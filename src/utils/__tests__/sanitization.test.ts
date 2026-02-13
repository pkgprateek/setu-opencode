import { describe, expect, test } from 'bun:test';
import { createPromptMultilineSanitizer, createPromptSanitizer } from '../sanitization';

describe('sanitization prompt variants', () => {
  test('single-line sanitizer flattens newlines', () => {
    const sanitize = createPromptSanitizer(200);
    const output = sanitize('S01\nWhy: keep\nEdit(s): file\nCommands: N/A');
    expect(output.includes('\n')).toBe(false);
  });

  test('multiline sanitizer preserves newlines for plan artifacts', () => {
    const sanitize = createPromptMultilineSanitizer(200);
    const output = sanitize('S01\nWhy: keep\nEdit(s): file\nCommands: N/A');
    expect(output.includes('\n')).toBe(true);
    expect(output).toContain('Why: keep');
  });
});
