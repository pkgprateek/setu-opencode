import { describe, expect, test } from 'bun:test';
import { classifyToolCapability } from '../capability';

describe('capability classifier', () => {
  test('classifies search-like external tool as read_only', () => {
    const result = classifyToolCapability('google_search', {
      query: 'quote of the day',
      thinking: true,
    });

    expect(result.final).toBe('read_only');
  });

  test('classifies mutating shapes without tool allowlist', () => {
    const result = classifyToolCapability('custom_tool', {
      content: 'new text',
      filePath: 'hola.txt',
    });

    expect(result.final).toBe('mutating');
  });

  test('classifies unknown unsafe shape as unknown', () => {
    const result = classifyToolCapability('foo_bar_tool', {
      payload: { anything: true },
      opaque: 'x',
    });

    expect(result.final).toBe('unknown');
  });
});
