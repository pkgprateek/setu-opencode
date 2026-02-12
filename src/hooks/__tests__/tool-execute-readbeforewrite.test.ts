import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createToolExecuteBeforeHook } from '../tool-execute';
import { clearDisciplineState, type ContextCollector } from '../../context';

mock.module('../../debug', () => ({
  debugLog: () => {},
  alwaysLog: () => {},
  errorLog: () => {},
}));

describe('tool-execute read-before-write guards', () => {
  let projectDir = '';
  let existingFile = '';
  let sessionID = '';

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'setu-overwrite-'));
    const setuDir = join(projectDir, '.setu');
    mkdirSync(setuDir, { recursive: true });
    writeFileSync(join(setuDir, 'RESEARCH.md'), '# research', 'utf-8');
    writeFileSync(join(setuDir, 'PLAN.md'), '# plan', 'utf-8');
    existingFile = join(projectDir, 'hello.txt');
    writeFileSync(existingFile, 'hello', 'utf-8');
    sessionID = `overwrite-${Date.now()}`;
  });

  afterEach(() => {
    clearDisciplineState(sessionID);
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('blocks edit without prior read', async () => {
    const collector = {
      getContext: () => ({ filesRead: [] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-1' },
        { args: { filePath: 'hello.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).rejects.toThrow('Read required before overwrite');
  });

  test('allows edit after file was read', async () => {
    const collector = {
      getContext: () => ({ filesRead: [{ path: 'hello.txt' }] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-2' },
        { args: { filePath: 'hello.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).resolves.toBeUndefined();
  });

  test('blocks edit when file does not exist', async () => {
    const collector = {
      getContext: () => ({ filesRead: [] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-3' },
        { args: { filePath: 'missing.txt', oldString: 'hello', newString: 'hi' } }
      )
    ).rejects.toThrow('File does not exist');
  });

  test('blocks path traversal attempts', async () => {
    const collector = {
      getContext: () => ({ filesRead: [] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-traversal' },
        { args: { filePath: '../../../etc/passwd', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow('Path Security');
  });

  test('blocks absolute path outside project', async () => {
    const collector = {
      getContext: () => ({ filesRead: [] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-abs' },
        { args: { filePath: '/etc/passwd', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow('Path Security');
  });

  test('blocks null byte injection in file path', async () => {
    const collector = {
      getContext: () => ({ filesRead: [] }),
    } as unknown as ContextCollector;

    const hook = createToolExecuteBeforeHook(
      () => 'setu',
      () => collector,
      () => projectDir,
      undefined,
      () => ({ contextConfirmed: true, sessionId: sessionID, startedAt: Date.now() })
    );

    await expect(
      hook(
        { tool: 'edit', sessionID, callID: 'edit-nullbyte' },
        { args: { filePath: 'hello.txt\x00.sh', oldString: '', newString: 'pwned' } }
      )
    ).rejects.toThrow();
  });
});
