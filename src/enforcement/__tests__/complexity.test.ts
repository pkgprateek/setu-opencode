import { describe, expect, test } from 'bun:test';
import { evaluatePolicyDecision } from '../complexity';

describe('complexity policy engine', () => {
  test('executes low-complexity write in scout', () => {
    const result = evaluatePolicyDecision({
      tool: 'write',
      args: { filePath: 'note.txt', content: 'hello' },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    expect(result.action).toBe('execute');
    expect(result.score).toBeLessThan(3);
  });

  test('asks for higher-complexity bash request', () => {
    const result = evaluatePolicyDecision({
      tool: 'bash',
      args: { command: 'npm run build && npm run test && npm run lint' },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    expect(result.action).toBe('ask');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  test('hard-safety overrides complexity', () => {
    const result = evaluatePolicyDecision({
      tool: 'bash',
      args: { command: 'rm -rf /tmp/demo' },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: true,
      hardSafetyReasons: ['Destructive shell command detected'],
      hardSafetyAction: 'block',
    });

    expect(result.action).toBe('block');
    expect(result.hardSafety).toBe(true);
  });

  test('builder with active task executes by default', () => {
    const result = evaluatePolicyDecision({
      tool: 'edit',
      args: { filePath: 'src/index.ts' },
      gear: 'builder',
      hasActiveTask: true,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    expect(result.action).toBe('execute');
  });

  test('fresh-session scout flow stays on fast path for simple request', () => {
    const todoDecision = evaluatePolicyDecision({
      tool: 'todowrite',
      args: { todos: [{ content: 'Create scout.txt', status: 'pending' }] },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    const taskDecision = evaluatePolicyDecision({
      tool: 'setu_task',
      args: { action: 'create', task: 'Create scout.txt with quote' },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    const writeDecision = evaluatePolicyDecision({
      tool: 'write',
      args: { filePath: 'scout.txt', content: 'Keep going.' },
      gear: 'scout',
      hasActiveTask: false,
      hardSafety: false,
      hardSafetyReasons: [],
      hardSafetyAction: 'ask',
    });

    expect(todoDecision.action).toBe('execute');
    expect(taskDecision.action).toBe('execute');
    expect(writeDecision.action).toBe('execute');
  });
});
