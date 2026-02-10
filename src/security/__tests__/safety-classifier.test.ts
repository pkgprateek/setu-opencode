import { describe, expect, test } from 'bun:test';
import { classifyHardSafety } from '../safety-classifier';

describe('safety classifier', () => {
  test('blocks destructive shell commands', () => {
    const result = classifyHardSafety('bash', { command: 'rm -rf /tmp/demo' });
    expect(result.hardSafety).toBe(true);
    expect(result.action).toBe('block');
  });

  test('asks for production-impacting commands', () => {
    const result = classifyHardSafety('bash', { command: 'npm publish' });
    expect(result.hardSafety).toBe(true);
    expect(result.action).toBe('ask');
  });

  test('asks for shell file mutation commands', () => {
    const result = classifyHardSafety('bash', { command: 'touch hello.txt' });
    expect(result.hardSafety).toBe(true);
    expect(result.action).toBe('ask');
  });

  test('asks for sensitive file writes', () => {
    const result = classifyHardSafety('write', { filePath: '.env.local', content: 'TOKEN=x' });
    expect(result.hardSafety).toBe(true);
    expect(result.action).toBe('ask');
  });

  test('returns no hard safety for simple write', () => {
    const result = classifyHardSafety('write', { filePath: 'scout.txt', content: 'quote' });
    expect(result.hardSafety).toBe(false);
  });
});
