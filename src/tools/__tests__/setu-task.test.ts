import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createSetuTaskTool } from '../setu-task';
import { loadActiveTask } from '../../context/active';

function makeProjectDir(): string {
  return mkdtempSync(join(tmpdir(), 'setu-task-'));
}

describe('setu_task lifecycle actions', () => {
  test('create archives existing artifacts and resets workflow boundary', async () => {
    const projectDir = makeProjectDir();
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# old research\n', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# old plan\n', 'utf-8');

    const tool = createSetuTaskTool(() => projectDir);
    const result = await tool.execute({ action: 'create', task: 'Fix auth bug' }, {} as never);

    expect(result).toContain('Task Created');
    expect(existsSync(join(setuDir, 'RESEARCH.md'))).toBe(false);
    expect(existsSync(join(setuDir, 'PLAN.md'))).toBe(false);

    const history = readFileSync(join(setuDir, 'HISTORY.md'), 'utf-8');
    expect(history).toContain('Archived Research');
    expect(history).toContain('Archived Plan');

    const active = loadActiveTask(projectDir);
    expect(active?.task).toBe('Fix auth bug');
    expect(active?.status).toBe('in_progress');
  });

  test('reframe updates task intent and preserves artifacts', async () => {
    const projectDir = makeProjectDir();
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# current research\n', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# current plan\n', 'utf-8');

    const tool = createSetuTaskTool(() => projectDir);
    await tool.execute({ action: 'create', task: 'Implement auth flow' }, {} as never);

    // Re-create artifacts after create boundary reset to verify reframe preserves them
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# reframed research\n', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# reframed plan\n', 'utf-8');

    const result = await tool.execute(
      { action: 'reframe', task: 'Refine auth flow for backward compatibility', constraints: ['NO_PUSH'] },
      {} as never
    );

    expect(result).toContain('Task Reframed');
    expect(existsSync(join(setuDir, 'RESEARCH.md'))).toBe(true);
    expect(existsSync(join(setuDir, 'PLAN.md'))).toBe(true);

    const active = loadActiveTask(projectDir);
    expect(active?.task).toBe('Refine auth flow for backward compatibility');
    expect(active?.constraints).toEqual(['NO_PUSH']);
  });

  test('update_status changes status without modifying artifacts', async () => {
    const projectDir = makeProjectDir();
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });

    const tool = createSetuTaskTool(() => projectDir);
    await tool.execute({ action: 'create', task: 'Stabilize verify behavior' }, {} as never);

    writeFileSync(join(setuDir, 'RESEARCH.md'), '# keep me\n', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# keep me too\n', 'utf-8');

    const result = await tool.execute({ action: 'update_status', status: 'blocked' }, {} as never);
    expect(result).toContain('Task Updated');
    expect(result).toContain('blocked');

    const active = loadActiveTask(projectDir);
    expect(active?.status).toBe('blocked');
    expect(existsSync(join(setuDir, 'RESEARCH.md'))).toBe(true);
    expect(existsSync(join(setuDir, 'PLAN.md'))).toBe(true);
  });

  test('reframe blocks constraint downgrade attempts', async () => {
    const projectDir = makeProjectDir();
    const tool = createSetuTaskTool(() => projectDir);

    await tool.execute(
      { action: 'create', task: 'Harden scout boundaries', constraints: ['READ_ONLY', 'NO_DELETE'] },
      {} as never
    );

    const result = await tool.execute(
      { action: 'reframe', task: 'Harden scout boundaries v2', constraints: ['NO_PUSH'] },
      {} as never
    );

    expect(result).toContain('Task Reframed');

    const active = loadActiveTask(projectDir);
    expect(active?.task).toBe('Harden scout boundaries v2');
    expect(active?.constraints).toEqual(['READ_ONLY', 'NO_DELETE']);
  });

  test('create and reframe sanitize control characters in task text', async () => {
    const projectDir = makeProjectDir();
    const tool = createSetuTaskTool(() => projectDir);

    await tool.execute(
      { action: 'create', task: 'Fix auth\u0000 flow\u0007' },
      {} as never
    );

    let active = loadActiveTask(projectDir);
    expect(active?.task).toBe('Fix auth flow');

    await tool.execute(
      { action: 'reframe', task: 'Refine\u0000 auth\u0007 flow' },
      {} as never
    );

    active = loadActiveTask(projectDir);
    expect(active?.task).toBe('Refine auth flow');
  });

  test('legacy update action is rejected', async () => {
    const projectDir = makeProjectDir();
    const tool = createSetuTaskTool(() => projectDir);

    const result = await tool.execute({ action: 'update', status: 'completed' }, {} as never);
    expect(result).toContain('Unknown action');
    expect(result).toContain('update_status');
  });
});
