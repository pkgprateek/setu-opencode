import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createToolExecuteBeforeHook } from '../tool-execute';
import { clearDisciplineState, type ContextCollector } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute before hook hydration enforcement', () => {
  let projectDir = '';
  let sessionID = '';

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'setu-hydration-'));
    // Generate unique session ID for each test
    sessionID = `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  });

  afterEach(() => {
    clearDisciplineState(sessionID);
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('blocks write before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID, callID: 'c1' },
        { args: { filePath: 'a.txt', content: 'x' } }
      )
    ).rejects.toThrow('Wait:');

    const securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('HYDRATION_BLOCKED');
    expect(securityLog).toContain('tool:write');
  });

  test('blocks mutating and unknown tools before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'bash', sessionID, callID: 'c5-bash' },
        { args: { command: 'rm -rf /tmp/demo' } }
      )
    ).rejects.toThrow('Wait:');

    await expect(
      hook(
        { tool: 'delete', sessionID, callID: 'c5-delete' },
        { args: { filePath: 'a.txt' } }
      )
    ).rejects.toThrow('Wait:');

    await expect(
      hook(
        { tool: 'execute', sessionID, callID: 'c5-execute' },
        { args: {} }
      )
    ).rejects.toThrow('Wait:');

    await expect(
      hook(
        { tool: 'multi_edit', sessionID, callID: 'c5-multiedit' },
        { args: { edits: [] } }
      )
    ).rejects.toThrow('Wait:');

    await expect(
      hook(
        { tool: 'unknown_dangerous_tool', sessionID, callID: 'c5-unknown' },
        { args: {} }
      )
    ).rejects.toThrow('Wait:');

    const securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('tool:bash');
    expect(securityLog).toContain('tool:delete');
    expect(securityLog).toContain('tool:execute');
    expect(securityLog).toContain('tool:multi_edit');
    expect(securityLog).toContain('tool:unknown_dangerous_tool');
  });

  test('allows read-only tools before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'read', sessionID, callID: 'c2' },
        { args: { filePath: 'README.md' } }
      )
    ).resolves.toBeUndefined();
  });

  test('allows setu_context before context confirmed', async () => {
    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'setu_context', sessionID, callID: 'c3' },
        { args: { summary: 'x', task: 'y' } }
      )
    ).resolves.toBeUndefined();
  });

  test('unlocks write after context confirmed', async () => {
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# research', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# plan', 'utf-8');

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => null,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID, callID: 'c4' },
        { args: { filePath: 'new-file.txt', content: 'ok' } }
      )
    ).resolves.toBeUndefined();
  });

  test('unlocks write when hydration state is stale but persisted context is confirmed', async () => {
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# research', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# plan', 'utf-8');

    let loadFromDiskCalls = 0;
    let confirmed = false;

    const collector: ContextCollector = {
      getContext: () => ({
        version: '1.0',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        confirmed,
        project: {},
        filesRead: [],
        searchesPerformed: [],
        patterns: [],
      }),
      recordFileRead: () => {},
      recordSearch: () => {},
      addPattern: () => {},
      updateProjectInfo: () => {},
      confirm: () => {},
      reset: () => {},
      loadFromDisk: () => {
        loadFromDiskCalls += 1;
        confirmed = true;
        return true;
      },
      saveToDisk: () => {},
      debouncedSave: Object.assign(() => {}, { cancel: () => {} }),
    };

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID, callID: 'c6' },
        { args: { filePath: 'new-file.txt', content: 'ok' } }
      )
    ).resolves.toBeUndefined();

    expect(loadFromDiskCalls).toBe(1);

    const securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('HYDRATION_FALLBACK_ALLOWED');
    expect(securityLog).toContain('tool:write');
  });

  test('still blocks write when hydration is stale and persisted context is not confirmed', async () => {
    const collector: ContextCollector = {
      getContext: () => ({
        version: '1.0',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        confirmed: false,
        project: {},
        filesRead: [],
        searchesPerformed: [],
        patterns: [],
      }),
      recordFileRead: () => {},
      recordSearch: () => {},
      addPattern: () => {},
      updateProjectInfo: () => {},
      confirm: () => {},
      reset: () => {},
      loadFromDisk: () => false,
      saveToDisk: () => {},
      debouncedSave: Object.assign(() => {}, { cancel: () => {} }),
    };

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: false, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'write', sessionID, callID: 'c7' },
        { args: { filePath: 'a.txt', content: 'x' } }
      )
    ).rejects.toThrow('Wait:');

    const securityLog = readFileSync(join(projectDir, '.setu', 'security.log'), 'utf-8');
    expect(securityLog).toContain('HYDRATION_BLOCKED');
    expect(securityLog).toContain('tool:write');
  });
});
